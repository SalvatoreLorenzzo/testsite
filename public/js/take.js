$(document).ready(function() {
    const params = new URLSearchParams(window.location.search);
    const testCode = params.get('code');
    const participantName = sessionStorage.getItem('participantName');

    if (!testCode) { window.location.href = '/'; return; }
    
    let testData = {};
    let userAnswers = [];
    let currentQuestionIndex = 0;
    let testTimer, questionTimer;
    let testStartTime;
    let isTestSubmitted = false;

    // --- ЛОГІКА ЗБЕРЕЖЕННЯ/ВІДНОВЛЕННЯ СТАНУ ---
    function saveTestState() {
        if (isTestSubmitted) return;
        const state = { userAnswers, currentQuestionIndex, testStartTime: testStartTime.toISOString(), testData };
        sessionStorage.setItem(`testState_${testCode}`, JSON.stringify(state));
    }

    function loadTestState() {
        const savedState = sessionStorage.getItem(`testState_${testCode}`);
        if (savedState) {
            const state = JSON.parse(savedState);
            userAnswers = state.userAnswers; currentQuestionIndex = state.currentQuestionIndex;
            testStartTime = new Date(state.testStartTime); testData = state.testData;
            return true;
        }
        return false;
    }

    function saveResultState(result) {
        sessionStorage.setItem(`resultState_${testCode}`, JSON.stringify(result));
    }

    function loadResultState() {
        const savedResult = sessionStorage.getItem(`resultState_${testCode}`);
        return savedResult ? JSON.parse(savedResult) : null;
    }

    function clearTestState() {
        sessionStorage.removeItem(`testState_${testCode}`);
    }

    // Обробник, що спрацьовує перед закриттям/перезавантаженням сторінки
    $(window).on('beforeunload', function(e) {
        if (!isTestSubmitted) { 
            saveTestState(); 
            e.preventDefault(); 
            e.returnValue = ''; 
            return ''; 
        }
    });

    // --- ЛОГІКА ТАЙМЕРІВ ---
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
        
        $('#test-timer').text(formatTime(seconds));
        testTimer = setInterval(() => {
            seconds--;
            $('#test-timer').text(formatTime(seconds));
            if (seconds <= 0) { 
                clearInterval(testTimer); 
                alert('Час вийшов!'); 
                submitTest(); 
            }
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
            startQuestionTimer(question); // Рекурсивний виклик для оновлення UI
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

// --- ПОЧАТОК ЧАСТИНИ 2 ---
// Цей код є продовженням попередньої відповіді

    function moveToNextQuestion() {
        saveCurrentAnswer();
        if (currentQuestionIndex < testData.questions.length - 1) {
            currentQuestionIndex++;
            renderQuestion(currentQuestionIndex);
        } else {
            $('#finish-btn').trigger('click');
        }
    }

    function renderQuestion(index) {
        clearInterval(questionTimer);
        const question = testData.questions[index];
        $('#question-header').text(`Питання ${index + 1} з ${testData.questions.length}`);
        const inputType = question.multipleChoice ? 'checkbox' : 'radio';
        const questionImageHtml = question.image ? `<div class="question-image-container"><a href="${question.image}"><img src="${question.image}" class="question-image-display"></a></div>` : '';
        const deselectBtnHtml = !question.multipleChoice ? `<span class="deselect-btn" data-question-index="${index}">Очистити</span>` : '';
        const questionBody = `<div class="question-title-wrapper"><h5 class="text-light">${question.q}</h5>${deselectBtnHtml}</div>${questionImageHtml}<div class="options-wrapper">${question.options.map((opt, optIndex) => `<label class="option-wrapper d-flex align-items-center"><input class="option-input" type="${inputType}" name="q-${index}" value="${optIndex}">${opt.image ? `<div class="option-image-container"><a href="${opt.image}"><img src="${opt.image}" class="result-image"></a></div>` : ''}<span class="form-check-label ml-2">${opt.text}</span></label>`).join('')}</div>`;
        $('#question-body').html(questionBody);
        
        new SimpleLightbox('#question-body a');

        const storedAnswer = userAnswers.find(a => a.q === question.q);
        if (storedAnswer) {
            storedAnswer.answers.forEach(originalIndex => {
                const shuffledIndex = question.optionsMap.indexOf(originalIndex);
                if (shuffledIndex > -1) {
                    const input = $(`input[name=q-${index}][value=${shuffledIndex}]`);
                    input.prop('checked', true);
                    input.closest('.option-wrapper').addClass('selected');
                }
            });
        }
        
        const isAnswered = storedAnswer && storedAnswer.answers.length > 0;
        const isTimedOut = storedAnswer && storedAnswer.timedOut;
        if ((!testData.settings.allowChangeAnswer && isAnswered) || isTimedOut) { 
            $('.option-input').prop('disabled', true);
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
        $('#progress-bar').css('width', `${progress}%`);
        $('#progress-text').text(`${currentQuestionIndex + 1} / ${testData.questions.length}`);
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
            if (!existingAnswer.timedOut) { userAnswers[existingAnswerIndex] = { ...existingAnswer, ...currentAnswer }; }
        } else {
            userAnswers.push(currentAnswer);
        }
    }

    function submitTest() {
        if (isTestSubmitted) return;
        isTestSubmitted = true;
        
        const submitBtn = $('#confirm-submit-btn');
        submitBtn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Відправка...');
        
        clearInterval(testTimer); clearInterval(questionTimer);
        saveCurrentAnswer();
        
        const submission = { participantName, answers: userAnswers, startTime: testStartTime };
        fetch(`/api/tests/${testCode}/submit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission), keepalive: true
        }).then(res => res.json()).then(result => {
            $('#confirmSubmitModal').modal('hide');
            saveResultState(result);
            renderResults(result);
        }).catch(err => {
            console.error('Submit error:', err);
            alert('Помилка відправки тесту.');
            submitBtn.prop('disabled', false).text('Так, завершити');
        });
    }

    function renderResults(result) {
        $('#test-view').hide();
        const resultView = $('#result-view');
        let html = `<h2 class="text-center">Результати</h2>`;
        
        if (result.showScore) {
            html += `<h3 class="text-center alert alert-info">Ваш результат: ${result.score} з ${result.total}</h3>`;
        } else {
            html += `<p class="text-center alert alert-secondary">Тест завершено. Дякуємо за участь!</p>`;
        }
        
        if (result.showAnswers && result.detailedResult) {
            result.detailedResult.forEach((res, index) => {
                const cardResultClass = res.questionScore >= 0.99 ? 'is-correct-card' : (res.questionScore > 0 ? 'is-partially-correct-card' : 'is-incorrect-card');
                let optionsHtml = '';
                res.options.forEach((option, optIndex) => {
                    let liClasses = 'list-group-item d-flex align-items-center';
                    let iconHtml = '<i class="answer-icon"></i>';
                    const isCorrect = res.correctAnswers.includes(optIndex);
                    const isUserAnswer = res.userAnswers.includes(optIndex);
                    if (isUserAnswer) {
                        liClasses += isCorrect ? ' answer-user-correct' : ' answer-user-incorrect';
                        iconHtml = `<i class="answer-icon ${isCorrect ? 'correct fas fa-check' : 'incorrect fas fa-times'}"></i>`;
                    } else if (isCorrect) {
                        iconHtml = '<i class="answer-icon correct fas fa-check"></i>';
                    }
                    const imageHtml = option.image ? `<div class="option-image-container"><a href="${option.image}"><img src="${option.image}" class="result-image"></a></div>` : '';
                    optionsHtml += `<li class="${liClasses}">${iconHtml}${imageHtml}${option.text}</li>`;
                });
                const questionImageHtml = res.image ? `<div class="question-image-container"><a href="${res.image}"><img src="${res.image}" class="question-image-display"></a></div>` : '';
                html += `
                    <div class="card answer-card mt-4 ${cardResultClass}">
                        <div class="card-header"><h5>Питання ${index + 1}: ${res.q}</h5></div>
                        <div class="card-body">${questionImageHtml}<ul class="list-group list-group-flush">${optionsHtml}</ul></div>
                        <div class="card-footer text-right">Набрано: ${res.questionScore} з 1</div>
                    </div>`;
            });
        }

        resultView.html(html);
        resultView.append('<div class="text-center mt-5"><a href="/" class="btn btn-lg btn-outline-info">На головну</a></div>');
        
        resultView.show();
        clearTestState();
    }

    // Обробники подій
    $('#finish-btn').on('click', () => saveCurrentAnswer());
    $('#confirm-submit-btn').on('click', submitTest);
    $('#question-body').on('change', '.option-input', function() {
        const name = $(this).attr('name');
        $(`input[name="${name}"]`).closest('.option-wrapper').removeClass('selected');
        $(`input[name="${name}"]:checked`).closest('.option-wrapper').addClass('selected');
        updateNavigation();
    });
    $('#question-body').on('click', '.deselect-btn', function() {
        const index = $(this).data('question-index');
        $(`input[name=q-${index}]`).prop('checked', false).closest('.option-wrapper').removeClass('selected');
        updateNavigation();
    });
    $('#next-btn').on('click', moveToNextQuestion);
    $('#prev-btn').on('click', () => { saveCurrentAnswer(); currentQuestionIndex--; renderQuestion(currentQuestionIndex); });

    // Головна логіка завантаження сторінки
    const savedResult = loadResultState();
    if (savedResult) {
        $('#test-title-header').text("Результати тесту");
        renderResults(savedResult);
    } else if (performance.getEntriesByType("navigation")[0].type === "reload" && loadTestState()) {
        submitTest();
    } else if (participantName) {
        fetch(`/api/tests/${testCode}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        .then(res => { if (!res.ok) return res.json().then(err => Promise.reject(err)); return res.json(); })
        .then(data => {
            testData = data;
            testStartTime = new Date();
            $('#test-title-header').text(testData.title);
            if (testData.settings.timeLimit > 0) {
                $('#test-timer').show();
                startTestTimer(testData.settings.timeLimit);
            } else {
                $('#test-timer').hide();
            }
            renderQuestion(currentQuestionIndex);
        })
        .catch(err => { $('body').html(`<div class="container mt-5"><div class="alert alert-danger"><strong>Помилка:</strong> ${err.message}</div><a href="/" class="btn btn-primary">Повернутись на головну</a></div>`); });
    } else {
        window.location.href = '/';
    }
});