const express = require('express');
const cors =require('cors');
const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const JWT_SECRET = 'your-super-secret-key-for-jwt';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('trust proxy', true);

const ensureDataDirs = async () => {
    await fs.mkdir(path.join(DATA_DIR, 'users'), { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'tests'), { recursive: true });
    await fs.mkdir(path.join(DATA_DIR, 'results'), { recursive: true });
};

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ message: 'Authorization token required' }); }
    const token = authHeader.split(' ')[1];
    try { const decoded = jwt.verify(token, JWT_SECRET); req.user = decoded; next(); }
    catch (e) { return res.status(401).json({ message: 'Invalid or expired token' }); }
};

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) { return res.status(400).json({ message: 'Invalid username or password' }); }
    try {
        const userFiles = await fs.readdir(path.join(DATA_DIR, 'users'));
        for (const file of userFiles) {
            const user = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'users', file)));
            if (user.username === username) { return res.status(409).json({ message: 'User already exists' }); }
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        await fs.writeFile(path.join(DATA_DIR, 'users', `${userId}.json`), JSON.stringify({ userId, username, passwordHash }));
        res.status(201).json({ message: 'User registered successfully' });
    } catch (e) { res.status(500).json({ message: 'Server error during registration' }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const userFiles = await fs.readdir(path.join(DATA_DIR, 'users'));
        for (const file of userFiles) {
            const user = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'users', file)));
            if (user.username === username) {
                const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
                if (isPasswordCorrect) {
                    const token = jwt.sign({ userId: user.userId, username }, JWT_SECRET, { expiresIn: '1h' });
                    return res.json({ token });
                }
            }
        }
        res.status(401).json({ message: 'Invalid credentials' });
    } catch (e) { res.status(500).json({ message: 'Server error during login' }); }
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const testFiles = await fs.readdir(path.join(DATA_DIR, 'tests'));
        const resultsFiles = await fs.readdir(path.join(DATA_DIR, 'results'));
        const userTests = [];
        const resultsCountMap = {};
        for (const resultFile of resultsFiles) {
            try {
                const result = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'results', resultFile)));
                resultsCountMap[result.testCode] = (resultsCountMap[result.testCode] || 0) + 1;
            } catch (e) { console.error(`Failed to parse result file: ${resultFile}`); }
        }
        for (const testFile of testFiles) {
            try {
                const test = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'tests', testFile)));
                if (test.ownerId === req.user.userId) {
                    userTests.push({ code: test.code, title: test.title, resultsCount: resultsCountMap[test.code] || 0, settings: test.settings });
                }
            } catch (e) { console.error(`Failed to parse test file: ${testFile}`); }
        }
        res.json({ username: req.user.username, tests: userTests });
    } catch(e) { res.status(500).json({message: "Server error reading dashboard data."}) }
});

app.post('/api/tests', authMiddleware, async (req, res) => {
    const { title, questions, settings } = req.body;
    const ownerId = req.user.userId;
    if (!title || !questions || !Array.isArray(questions) || questions.length === 0 || !settings) {
        return res.status(400).json({ message: 'Invalid test data format.' });
    }
    try {
        const generateCode = () => Math.random().toString().slice(2, 12);
        let code;
        const existingTests = await fs.readdir(path.join(DATA_DIR, 'tests'));
        do { code = generateCode(); } while (existingTests.includes(`${code}.json`));
        const newTest = { code, ownerId, title, questions, settings };
        await fs.writeFile(path.join(DATA_DIR, 'tests', `${code}.json`), JSON.stringify(newTest, null, 2));
        res.status(201).json({ code, title });
    } catch (e) { res.status(500).json({ message: "Server error creating test."}) }
});

app.post('/api/tests/:code/start', async (req, res) => {
    const testPath = path.join(DATA_DIR, 'tests', `${req.params.code}.json`);
    try {
        const test = JSON.parse(await fs.readFile(testPath));
        if (test.settings.closeDate && new Date() > new Date(test.settings.closeDate)) {
            return res.status(403).json({ message: 'Термін проходження тесту минув.' });
        }
        let questionsForUser = test.questions.map((q, originalIndex) => ({ ...q, originalIndex }));
        if (test.settings.shuffleQuestions) {
            questionsForUser.sort(() => Math.random() - 0.5);
        }
        const testForUser = {
            title: test.title,
            questions: questionsForUser.map(q => {
                let optionsWithOriginalIndex = q.options.map((opt, originalOptIndex) => ({ ...opt, originalOptIndex }));
                let shuffledOptions = [...optionsWithOriginalIndex];
                if (test.settings.shuffleAnswers) {
                    shuffledOptions.sort(() => Math.random() - 0.5);
                }
                return {
                    q: q.q, options: shuffledOptions.map(opt => ({ text: opt.text })),
                    multipleChoice: q.multipleChoice, timeLimitSeconds: q.timeLimitSeconds,
                    optionsMap: shuffledOptions.map(opt => opt.originalOptIndex)
                };
            }),
            settings: test.settings
        };
        res.json(testForUser);
    } catch (e) { res.status(404).json({ message: 'Тест не знайдено' }); }
});

app.post('/api/tests/:code/submit', async (req, res) => {
    const testCode = req.params.code;
    const testPath = path.join(DATA_DIR, 'tests', `${testCode}.json`);
    try {
        const originalTest = JSON.parse(await fs.readFile(testPath));
        const { participantName, answers, startTime } = req.body;
        if (!participantName || !answers || !startTime) { return res.status(400).json({ message: 'Incomplete submission data' }); }
        if (originalTest.settings.timeLimit > 0) {
            const timePassed = (new Date() - new Date(startTime)) / 1000 / 60;
            if (timePassed > originalTest.settings.timeLimit + 0.1) {
                return res.status(403).json({ message: 'Час на проходження тесту вичерпано' });
            }
        }
        let score = 0;
        const detailedResult = [];
        answers.forEach(userAnswer => {
            const originalQuestion = originalTest.questions.find(q => q.q === userAnswer.q);
            if (!originalQuestion) return;
            const correctAnswersIndexes = originalQuestion.correct;
            const isCorrect = userAnswer.answers.length === correctAnswersIndexes.length && userAnswer.answers.every(val => correctAnswersIndexes.includes(val));
            if (isCorrect) score++;
            detailedResult.push({ q: userAnswer.q, userAnswers: userAnswer.answers, correctAnswers: correctAnswersIndexes, isCorrect });
        });
        const resultId = uuidv4();
        const newResult = {
            resultId, testCode, participantName, score, total: originalTest.questions.length,
            submittedAt: new Date().toISOString(), ip: req.ip, userAnswers: answers
        };
        await fs.writeFile(path.join(DATA_DIR, 'results', `${resultId}.json`), JSON.stringify(newResult, null, 2));
        res.json({
            score, total: originalTest.questions.length,
            showAnswers: originalTest.settings.showAnswers, showScore: originalTest.settings.showScore,
            detailedResult: originalTest.settings.showAnswers ? detailedResult : null
        });
    } catch (e) { res.status(500).json({ message: 'Test not found or error during submission' }); }
});

app.get('/api/results/:code', authMiddleware, async (req, res) => {
    const testCode = req.params.code;
    const testPath = path.join(DATA_DIR, 'tests', `${testCode}.json`);
    try {
        const test = JSON.parse(await fs.readFile(testPath));
        if (test.ownerId !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
        const resultsFiles = await fs.readdir(path.join(DATA_DIR, 'results'));
        const testResults = [];
        for (const file of resultsFiles) {
            try {
                const result = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'results', file)));
                if (result.testCode === testCode) testResults.push(result);
            } catch (e) { console.error(`Could not read result file ${file}`); }
        }
        testResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        res.json({ title: test.title, results: testResults });
    } catch (e) { res.status(404).json({ message: 'Test not found' }); }
});

app.get('/api/results/details/:resultId', authMiddleware, async (req, res) => {
    const resultPath = path.join(DATA_DIR, 'results', `${req.params.resultId}.json`);
    try {
        const result = JSON.parse(await fs.readFile(resultPath));
        const testPath = path.join(DATA_DIR, 'tests', `${result.testCode}.json`);
        const test = JSON.parse(await fs.readFile(testPath));
        if (test.ownerId !== req.user.userId) return res.status(403).json({ message: 'Forbidden' });
        const detailedView = test.questions.map(originalQuestion => {
            const userAnswer = result.userAnswers.find(ua => ua.q === originalQuestion.q);
            return { q: originalQuestion.q, options: originalQuestion.options, correct: originalQuestion.correct, userAnswer: userAnswer ? userAnswer.answers : [] };
        });
        res.json({ participantName: result.participantName, submittedAt: result.submittedAt, detailedView });
    } catch (e) { res.status(404).json({ message: 'Result or test not found' }); }
});

const startServer = async () => {
    await ensureDataDirs();
    app.listen(PORT, () => { console.log(`Server is running on http://localhost:${PORT}`); });
};

startServer();