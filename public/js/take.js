$(document).ready(function() {
    const params = new URLSearchParams(window.location.search);
    const testCode = params.get('code');
    const participantName = sessionStorage.getItem('participantName');

    if (!testCode || !participantName) { window.location.href = '/'; return; }

    let testData = {};
    let userAnswers = [];
    let currentQuestionIndex = 0;
    let testTimer, questionTimer;
    let testStartTime;
    let isTestSubmitted = false;

    function saveState() {
        if (isTestSubmitted) return;
        const state = {
            userAnswers,
            currentQuestionIndex,
            testStartTime,
            testData
        };
        sessionStorage.setItem(`testState_${testCode}`, JSON.stringify(state));
    }

    function loadState() {
        const savedState = sessionStorage.getItem(`testState_${testCode}`);
        if (savedState) {
            const state = JSON.parse(savedState);
            userAnswers = state.userAnswers;
            currentQuestionIndex = state.currentQuestionIndex;
            testStartTime = new Date(state.testStartTime);
            testData = state.testData;
            return true;
        }
        return false;
    }

    function clearState() {
        sessionStorage.removeItem(`testState_${testCode}`);
        sessionStorage.removeItem('participantName');
    }
    
    $(window).on('beforeunload', function() {
        if (!isTestSubmitted) {
            saveState();
            return "Ви впевнені, що хочете покинути сторінку? Ваш прогрес може бути втрачено, а тест завершено.";
        }
    });

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.round(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    function startTestTimer(durationMinutes) {
        if (durationMinutes <= 0) return;
        let totalSeconds = durationMinutes * 60;
        const elapsedSeconds = (new Date() - testStartTime) / 1000;
        let seconds = totalSeconds - elapsedSeconds;

        if (seconds <= 0) { submitTest(); return; }

        $('#timer').text(formatTime(seconds));
        testTimer = setInterval(() => {
            seconds--;
            $('#timer').text(formatTime(seconds));
            if (seconds <= 0) { clearInterval(testTimer); alert('Час вийшов!'); submitTest(); }
        }, 1000);
    }

    function startQuestionTimer(question) {
        clearInterval(questionTimer);
        $('#question-timer-container').hide();
        if (question.timeLimitSeconds <= 0) return;

        let answerEntry = userAnswers.find(a => a.q === question.q);
        if (!answerEntry) {
            answerEntry = { q: question.q, answers: [], questionStartTime: new Date() };
            userAnswers.push(answerEntry);
        }

        if (answerEntry.timedOut) {
            $('#question-timer-bar').css({ 'width': '0%', 'transition': 'none' });
            $('#question-timer-text').text('Час вийшов');
            $('#question-timer-container').show();
            return;
        }

        const timePassed = (new Date() - new Date(answerEntry.questionStartTime)) / 1000;
        let secondsLeft = question.timeLimitSeconds - timePassed;

        if (secondsLeft <= 0) {
            answerEntry.timedOut = true;
            $(`input[name=q-${currentQuestionIndex}]`).prop('disabled', true);
            startQuestionTimer(question);
            return;
        }

        $('#question-timer-container').show();
        $('#question-timer-bar').css({ 'transition': 'none', 'width': `${(secondsLeft / question.timeLimitSeconds) * 100}%` });
        
        setTimeout(() => {
            $('#question-timer-bar').css({ 'transition': `width ${secondsLeft}s linear`, 'width': '0%' });
        }, 50);

        questionTimer = setInterval(() => {
            secondsLeft--;
            $('#question-timer-text').text(formatTime(secondsLeft));
            if (secondsLeft <= 0) {
                clearInterval(questionTimer);
                answerEntry.timedOut = true;
                moveToNextQuestion();
            }
        }, 1000);
    }
    
    function moveToNextQuestion() {
        saveCurrentAnswer();
        if (currentQuestionIndex < testData.questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion(currentQuestionIndex);
        } else {
            submitTest();
        }
    }

    function renderQuestion(index) {
        clearInterval(questionTimer);
        const question = testData.questions[index];
        $('#question-header').text(`Питання ${index + 1} з ${testData.questions.length}`);
        const inputType = question.multipleChoice ? 'checkbox' : 'radio';
        const questionBody = `<h5>${question.q}</h5>
            ${question.options.map((opt, optIndex) => `
                <div class="form-check"><input class="form-check-input" type="${inputType}" name="q-${index}" value="${optIndex}"><label class="form-check-label">${opt.text}</label></div>
            `).join('')}`;
        $('#question-body').html(questionBody);
        
        const storedAnswer = userAnswers.find(a => a.q === question.q);
        if (storedAnswer) {
            storedAnswer.answers.forEach(originalIndex => {
                const shuffledIndex = question.optionsMap.indexOf(originalIndex);
                if (shuffledIndex > -1) { $(`input[name=q-${index}][value=${shuffledIndex}]`).prop('checked', true); }
            });
        }
        
        const isAnswered = storedAnswer && storedAnswer.answers.length > 0;
        const isTimedOut = storedAnswer && storedAnswer.timedOut;
        
        if ((!testData.settings.allowChangeAnswer && isAnswered) || isTimedOut) { 
            $(`input[name=q-${index}]`).prop('disabled', true);
        }
        
        startQuestionTimer(question);
        updateNavigation();
        updateProgressBar();
    }

    function updateNavigation() {
        const currentQ = testData.questions[currentQuestionIndex];
        $('#prev-btn').toggle(currentQuestionIndex > 0 && !testData.settings.disallowReturn);
        $('#next-btn').toggle(currentQuestionIndex < testData.questions.length - 1);
        $('#finish-btn').toggle(currentQuestionIndex === testData.questions.length - 1);

        const currentAnswer = getAnswerForCurrentQuestion();
        if (testData.settings.requireAnswer && currentAnswer.answers.length === 0 && currentQ.timeLimitSeconds <= 0) {
            $('#next-btn, #finish-btn').prop('disabled', true);
        } else {
            $('#next-btn, #finish-btn').prop('disabled', false);
        }
    }
    
    function updateProgressBar() {
        const progress = ((currentQuestionIndex + 1) / testData.questions.length) * 100;
        $('#progress-bar').css('width', `${progress}%`).text(`${currentQuestionIndex + 1}/${testData.questions.length}`);
    }

    function getAnswerForCurrentQuestion() {
        const selected = [];
        const question = testData.questions[currentQuestionIndex];
        $(`input[name=q-${currentQuestionIndex}]:checked`).each(function() {
            const shuffledIndex = parseInt($(this).val());
            selected.push(question.optionsMap[shuffledIndex]);
        });
        return { q: question.q, answers: selected };
    }

    function saveCurrentAnswer() {
        const currentAnswer = getAnswerForCurrentQuestion();
        const existingAnswerIndex = userAnswers.findIndex(a => a.q === currentAnswer.q);
        const existingAnswer = userAnswers[existingAnswerIndex];
        if (existingAnswer) {
            if (!existingAnswer.timedOut) {
                 userAnswers[existingAnswerIndex] = { ...existingAnswer, ...currentAnswer };
            }
        } else {
            userAnswers.push(currentAnswer);
        }
    }

    function submitTest() {
        if (isTestSubmitted) return;
        isTestSubmitted = true;
        clearInterval(testTimer); clearInterval(questionTimer);
        saveCurrentAnswer();
        const submission = { participantName, answers: userAnswers, startTime: testStartTime };
        fetch(`/api/tests/${testCode}/submit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission), keepalive: true
        }).then(res => res.json()).then(result => renderResults(result)).catch(err => console.error('Submit error:', err));
    }

    $('#question-card').on('change', 'input', updateNavigation);
    $('#next-btn').on('click', moveToNextQuestion);
    $('#prev-btn').on('click', () => { saveCurrentAnswer(); currentQuestionIndex--; renderQuestion(currentQuestionIndex); });
    $('#finish-btn').on('click', submitTest);
    
    function renderResults(result) {
        $('#test-view').hide();
        const resultView = $('#result-view');
        let html = '<h2 class="text-center">Результати</h2>';
        if (result.showScore) html += `<h3 class="text-center alert alert-info">Ваш результат: ${result.score} з ${result.total}</h3>`;
        else html += `<p class="text-center alert alert-secondary">Тест завершено. Дякуємо за участь!</p>`;
        if (result.showAnswers && result.detailedResult) {
            result.detailedResult.forEach((res, index) => {
                html += `<div class="card mt-3 ${res.isCorrect ? 'correct' : 'incorrect'}"><div class="card-body"><h5>${index + 1}. ${res.q}</h5><p><strong>Ваша відповідь:</strong> ${res.userAnswers.join(', ') || 'немає'}</p><p><strong>Правильна:</strong> ${res.correctAnswers.join(', ')}</p></div></div>`;
            });
        }
        resultView.html(html).show();
        clearState();
    }

    if (performance.getEntriesByType("navigation")[0].type === "reload") {
        if(loadState()) {
             submitTest();
        } else {
            $('body').html(`<div class="container mt-5"><div class="alert alert-danger"><strong>Помилка:</strong> Сторінку було перезавантажено. Спробуйте почати тест заново.</div><a href="/" class="btn btn-primary">Повернутись на головну</a></div>`);
        }
    } else {
        fetch(`/api/tests/${testCode}/start`, { method: 'POST' })
        .then(res => { if (!res.ok) return res.json().then(err => Promise.reject(err)); return res.json(); })
        .then(data => {
            testData = data;
            testStartTime = new Date();
            $('#test-title').text(testData.title);
            if (testData.settings.timeLimit > 0) {
                $('#test-title').after('<h4 class="text-center" id="timer"></h4>');
                startTestTimer(testData.settings.timeLimit);
            }
            renderQuestion(currentQuestionIndex);
        })
        .catch(err => { $('body').html(`<div class="container mt-5"><div class="alert alert-danger"><strong>Помилка:</strong> ${err.message}</div><a href="/" class="btn btn-primary">Повернутись на головну</a></div>`); });
    }
});