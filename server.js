const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_ROOT = path.join(DATA_DIR, 'users');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-jwt';

const transliterate = (text) => {
    const a = {"Ё":"YO","Й":"I","Ц":"TS","У":"U","К":"K","Е":"E","Н":"N","Г":"G","Ш":"SH","Щ":"SCH","З":"Z","Х":"H","Ъ":"","Ф":"F","Ы":"I","В":"V","А":"A","П":"P","Р":"R","О":"O","Л":"L","Д":"D","Ж":"ZH","Э":"E","Я":"Ya","Ч":"CH","С":"S","М":"M","И":"I","Т":"T","Ь":"","Б":"B","Ю":"YU","ё":"yo","й":"i","ц":"ts","у":"u","к":"k","е":"e","н":"n","г":"g","ш":"sh","щ":"sch","з":"z","х":"h","ъ":"","ф":"f","ы":"i","в":"v","а":"a","п":"p","р":"r","о":"o","л":"l","д":"d","ж":"zh","э":"e","я":"ya","ч":"ch","с":"s","м":"m","и":"i","т":"t","ь":"","б":"b","ю":"yu"};
    return text.split('').map(char => a[char] || char).join('').replace(/[^\w\d]/g, '_').replace(/__+/g, '_').toLowerCase();
};

const generateNumericCode = () => {
    const part1 = Math.floor(1000 + Math.random() * 9000);
    const part2 = Math.floor(1000 + Math.random() * 9000);
    const part3 = Math.floor(1000 + Math.random() * 9000);
    return `${part1}-${part2}-${part3}`;
};

const ensureDataDirs = async () => {
    await fs.mkdir(USER_DATA_ROOT, { recursive: true });
};

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.set('trust proxy', true);

const upload = multer({ dest: require('os').tmpdir() });

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) { return res.status(401).json({ message: 'Authorization token required' }); }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

app.get('/api/media/:username/:testCode/:imageName', async (req, res) => {
    try {
        const { username, testCode, imageName } = req.params;
        const imagePath = path.join(USER_DATA_ROOT, username, 'tests', testCode, imageName);
        if (fsSync.existsSync(imagePath)) {
            res.sendFile(imagePath);
        } else {
            res.status(404).send('Image not found');
        }
    } catch (error) {
        res.status(500).send('Server error');
    }
});

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || password.length < 4) { return res.status(400).json({ message: 'Invalid username or password' }); }
    const userDir = path.join(USER_DATA_ROOT, username);
    try {
        if (fsSync.existsSync(userDir)) {
            return res.status(409).json({ message: 'User already exists' });
        }
        await fs.mkdir(userDir, { recursive: true });
        await fs.mkdir(path.join(userDir, 'tests'), { recursive: true });
        const passwordHash = await bcrypt.hash(password, 10);
        const userId = uuidv4();
        const userProfile = { userId, username, passwordHash };
        await fs.writeFile(path.join(userDir, 'profile.json'), JSON.stringify(userProfile));
        res.status(201).json({ message: 'User registered successfully' });
    } catch (e) {
        console.error("Register Error:", e);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const profilePath = path.join(USER_DATA_ROOT, username, 'profile.json');
    try {
        if (!fsSync.existsSync(profilePath)) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const user = JSON.parse(await fs.readFile(profilePath));
        const isPasswordCorrect = await bcrypt.compare(password, user.passwordHash);
        if (isPasswordCorrect) {
            const token = jwt.sign({ userId: user.userId, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
            return res.json({ token });
        }
        res.status(401).json({ message: 'Invalid credentials' });
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ message: 'Server error during login' });
    }
});

app.get('/api/dashboard', authMiddleware, async (req, res) => {
    try {
        const userTestsDir = path.join(USER_DATA_ROOT, req.user.username, 'tests');
        const testFolders = await fs.readdir(userTestsDir);
        const userTests = [];
        for (const testFolder of testFolders) {
            const testFilePath = path.join(userTestsDir, testFolder, 'test.json');
            const resultsDir = path.join(userTestsDir, testFolder, 'results');
            if (fsSync.existsSync(testFilePath)) {
                const test = JSON.parse(await fs.readFile(testFilePath));
                let resultsCount = 0;
                if(fsSync.existsSync(resultsDir)) {
                    resultsCount = (await fs.readdir(resultsDir)).length;
                }
                userTests.push({ 
                    code: test.code,
                    title: test.title, 
                    resultsCount: resultsCount, 
                    settings: test.settings 
                });
            }
        }
        res.json({ username: req.user.username, tests: userTests });
    } catch(e) {
        console.error("Dashboard Error:", e);
        res.status(500).json({message: "Server error reading dashboard data."})
    }
});

app.post('/api/tests', authMiddleware, upload.any(), async (req, res) => {
    try {
        const testData = JSON.parse(req.body.testData);
        const { title, questions, settings } = testData;

        if (!title || !questions || !Array.isArray(questions) || questions.length === 0 || !settings) {
            return res.status(400).json({ message: 'Invalid test data format.' });
        }
        
        const userTestsDir = path.join(USER_DATA_ROOT, req.user.username, 'tests');

        let testCode;
        let testDir;
        do {
            testCode = generateNumericCode();
            testDir = path.join(userTestsDir, testCode);
        } while (fsSync.existsSync(testDir)); // Перевіряємо, чи такий код вже існує

        await fs.mkdir(testDir, { recursive: true });

        for (const file of req.files) {
            const [type, qIndex, oIndex] = file.fieldname.split('-');
            const newFileName = `${Date.now()}-${file.originalname}`;
            const finalPath = path.join(testDir, newFileName);
            
            await fs.rename(file.path, finalPath);

            if (type === 'qImage') {
                questions[qIndex].image = newFileName;
            } else if (type === 'oImage') {
                questions[qIndex].options[oIndex].image = newFileName;
            }
        }

        const newTest = { 
            code: testCode,
            ownerId: req.user.userId, 
            ownerUsername: req.user.username,
            title, 
            questions, 
            settings 
        };

        await fs.writeFile(path.join(testDir, 'test.json'), JSON.stringify(newTest, null, 2));
        res.status(201).json({ code: testCode, title });
    } catch (e) {
        console.error("Create Test Error:", e);
        req.files.forEach(file => fs.unlink(file.path).catch(console.error));
        res.status(500).json({ message: "Server error creating test."})
    }
});

app.post('/api/tests/:code/start', async (req, res) => {
    try {
        const testCode = req.params.code;
        let test = null;
        let ownerUsername = '';
        const userDirs = await fs.readdir(USER_DATA_ROOT);
        for (const userDir of userDirs) {
            const testPath = path.join(USER_DATA_ROOT, userDir, 'tests', testCode, 'test.json');
            if (fsSync.existsSync(testPath)) {
                test = JSON.parse(await fs.readFile(testPath));
                ownerUsername = userDir;
                break;
            }
        }
        if (!test) {
            return res.status(404).json({ message: 'Тест не знайдено' });
        }
        if (test.settings.closeDate && new Date() > new Date(test.settings.closeDate)) {
            return res.status(403).json({ message: 'Термін проходження тесту минув.' });
        }
        const testForUser = JSON.parse(JSON.stringify(test));
        testForUser.questions.forEach(q => {
            if (q.image) {
                q.image = `/api/media/${ownerUsername}/${testCode}/${q.image}`;
            }
            q.options.forEach(opt => {
                if(opt.image) {
                    opt.image = `/api/media/${ownerUsername}/${testCode}/${opt.image}`;
                }
            });
        });
        if (testForUser.settings.shuffleQuestions) {
            testForUser.questions.sort(() => Math.random() - 0.5);
        }
        testForUser.questions.forEach(q => {
            let optionsWithOriginalIndex = q.options.map((opt, originalOptIndex) => ({ ...opt, originalOptIndex }));
            let shuffledOptions = [...optionsWithOriginalIndex];
            if (testForUser.settings.shuffleAnswers) {
                shuffledOptions.sort(() => Math.random() - 0.5);
            }
            q.options = shuffledOptions.map(opt => ({ text: opt.text, image: opt.image }));
            q.optionsMap = shuffledOptions.map(opt => opt.originalOptIndex);
        });
        res.json({
            title: testForUser.title,
            questions: testForUser.questions,
            settings: testForUser.settings,
        });
    } catch (e) {
        console.error("Start Test Error:", e);
        res.status(404).json({ message: 'Тест не знайдено або сталася помилка' });
    }
});

app.post('/api/tests/:code/submit', async (req, res) => {
    const testCode = req.params.code;
    try {
        let originalTest = null;
        let testDir = '';
        let ownerUsername = '';
        const userDirs = await fs.readdir(USER_DATA_ROOT);
        for (const userDir of userDirs) {
            const currentTestDir = path.join(USER_DATA_ROOT, userDir, 'tests', testCode);
            if (fsSync.existsSync(path.join(currentTestDir, 'test.json'))) {
                originalTest = JSON.parse(await fs.readFile(path.join(currentTestDir, 'test.json')));
                testDir = currentTestDir;
                ownerUsername = userDir;
                break;
            }
        }
        if(!originalTest) {
            return res.status(404).json({ message: 'Test not found' });
        }
        const { participantName, answers, startTime } = req.body;
        let totalScore = 0;
        const detailedResult = originalTest.questions.map(originalQuestion => {
            const userAnswerEntry = answers.find(ua => ua.q === originalQuestion.q);
            const userAnswerIndexes = userAnswerEntry ? userAnswerEntry.answers : [];
            const correctAnswersIndexes = originalQuestion.correct;
            let questionScore = 0;
            if (correctAnswersIndexes.length > 0) {
                const pointsPerAnswer = 1 / correctAnswersIndexes.length;
                userAnswerIndexes.forEach(userAnswerIndex => {
                    if (correctAnswersIndexes.includes(userAnswerIndex)) questionScore += pointsPerAnswer;
                    else questionScore -= pointsPerAnswer;
                });
            }
            questionScore = Math.max(0, questionScore);
            totalScore += questionScore;
            if (originalQuestion.image) {
                originalQuestion.image = `/api/media/${ownerUsername}/${testCode}/${originalQuestion.image}`;
            }
            originalQuestion.options.forEach(opt => {
                if (opt.image) {
                    opt.image = `/api/media/${ownerUsername}/${testCode}/${opt.image}`;
                }
            });
            return {
                q: originalQuestion.q, options: originalQuestion.options, image: originalQuestion.image,
                userAnswers: userAnswerIndexes, correctAnswers: correctAnswersIndexes,
                questionScore: parseFloat(questionScore.toFixed(2))
            };
        });
        const resultId = uuidv4();
        const resultsDir = path.join(testDir, 'results');
        await fs.mkdir(resultsDir, { recursive: true });
        const newResult = {
            resultId, testCode, participantName, score: parseFloat(totalScore.toFixed(2)), 
            total: originalTest.questions.length, submittedAt: new Date().toISOString(), ip: req.ip, 
            detailedResult
        };
        await fs.writeFile(path.join(resultsDir, `${resultId}.json`), JSON.stringify(newResult, null, 2));
        res.json({
            score: newResult.score, total: newResult.total,
            showAnswers: originalTest.settings.showAnswers, showScore: originalTest.settings.showScore,
            detailedResult: originalTest.settings.showAnswers ? newResult.detailedResult : null
        });
    } catch (e) {
        console.error("Submit Test Error:", e);
        res.status(500).json({ message: 'Test not found or error during submission' });
    }
});

app.get('/api/results/:code', authMiddleware, async (req, res) => {
    const testCode = req.params.code;
    const testDir = path.join(USER_DATA_ROOT, req.user.username, 'tests', testCode);
    const testPath = path.join(testDir, 'test.json');
    try {
        if (!fsSync.existsSync(testPath)) return res.status(404).json({ message: 'Test not found' });
        const test = JSON.parse(await fs.readFile(testPath));
        if (test.ownerUsername !== req.user.username) return res.status(403).json({ message: 'Forbidden' });
        const resultsDir = path.join(testDir, 'results');
        const testResults = [];
        if(fsSync.existsSync(resultsDir)) {
            const resultsFiles = await fs.readdir(resultsDir);
            for (const file of resultsFiles) {
                const result = JSON.parse(await fs.readFile(path.join(resultsDir, file)));
                delete result.detailedResult;
                testResults.push(result);
            }
        }
        testResults.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        res.json({ title: test.title, results: testResults });
    } catch (e) {
        console.error("Get Results Error:", e);
        res.status(500).json({ message: 'Server Error' });
    }
});

app.get('/api/results/details/:resultId', authMiddleware, async (req, res) => {
    const resultId = req.params.resultId;
    const username = req.user.username;
    try {
        let result = null;
        const userTestsDir = path.join(USER_DATA_ROOT, username, 'tests');
        const testFolders = await fs.readdir(userTestsDir);
        for (const testFolder of testFolders) {
            const currentResultPath = path.join(userTestsDir, testFolder, 'results', `${resultId}.json`);
            if (fsSync.existsSync(currentResultPath)) {
                result = JSON.parse(await fs.readFile(currentResultPath));
                break;
            }
        }
        if (!result) return res.status(404).json({ message: 'Result not found' });
        res.json(result);
    } catch (e) {
        console.error("Result Details Error:", e);
        res.status(500).json({ message: 'Server error' });
    }
});

app.delete('/api/tests/:code', authMiddleware, async (req, res) => {
    const testCode = req.params.code;
    const testDir = path.join(USER_DATA_ROOT, req.user.username, 'tests', testCode);
    try {
        if (!fsSync.existsSync(testDir)) {
            return res.status(404).json({ message: 'Test not found' });
        }
        await fs.rm(testDir, { recursive: true, force: true });
        res.status(200).json({ message: 'Test deleted successfully' });
    } catch (e) {
        console.error("Delete Test Error:", e);
        res.status(500).json({ message: 'Server error during deletion' });
    }
});

app.delete('/api/results/:resultId', authMiddleware, async (req, res) => {
    const resultId = req.params.resultId;
    const username = req.user.username;
    try {
        let resultPathToDelete = '';
        const userTestsDir = path.join(USER_DATA_ROOT, username, 'tests');
        const testFolders = await fs.readdir(userTestsDir);
        for (const testFolder of testFolders) {
             const currentResultPath = path.join(userTestsDir, testFolder, 'results', `${resultId}.json`);
            if (fsSync.existsSync(currentResultPath)) {
                resultPathToDelete = currentResultPath;
                break;
            }
        }
        if (!resultPathToDelete) return res.status(404).json({ message: 'Result not found' });
        await fs.unlink(resultPathToDelete);
        res.status(200).json({ message: 'Result deleted successfully' });
    } catch (e) {
        console.error("Delete Result Error:", e);
        res.status(500).json({ message: 'Server error during deletion' });
    }
});

app.get('/api/export/:code', authMiddleware, async (req, res) => {
    const testCode = req.params.code;
    const testDir = path.join(USER_DATA_ROOT, req.user.username, 'tests', testCode);
    const testPath = path.join(testDir, 'test.json');

    try {
        if (!fsSync.existsSync(testPath)) {
            return res.status(404).json({ message: 'Test not found' });
        }
        const test = JSON.parse(await fs.readFile(testPath));
        const resultsDir = path.join(testDir, 'results');
        const testResults = [];
        if (fsSync.existsSync(resultsDir)) {
            const resultsFiles = await fs.readdir(resultsDir);
            for (const file of resultsFiles) {
                const result = JSON.parse(await fs.readFile(path.join(resultsDir, file)));
                testResults.push(result);
            }
        }

        const dataToExport = testResults.map(result => {
            const details = result.detailedResult.map(item => {
                // Видаляємо URL зображень для чистоти експорту
                const itemOptions = item.options.map(({ text }) => ({ text }));
                return {
                    question: item.q,
                    userAnswers: item.userAnswers.map(i => itemOptions[i].text),
                    correctAnswers: item.correctAnswers.map(i => itemOptions[i].text),
                    isCorrect: item.questionScore >= 0.99
                }
            });
            return {
                participantName: result.participantName,
                score: result.score,
                total: result.total,
                submittedAt: result.submittedAt,
                details
            };
        });

        res.json({ title: test.title, results: dataToExport });

    } catch (e) {
        console.error("Export Error:", e);
        res.status(500).json({ message: 'Server error during export' });
    }
});

const startServer = async () => {
    await ensureDataDirs();
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
};

startServer();