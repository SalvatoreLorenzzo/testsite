$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }

    let questionCounter = 0;

    function addQuestion() {
        questionCounter++;
        const questionHtml = `
            <div class="card mt-3 question-block" data-question-id="${questionCounter}">
                <div class="card-header d-flex justify-content-between align-items-center"><span>Питання ${questionCounter}</span></div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group col-md-9"><label>Текст питання:</label><input type="text" class="form-control question-text" required></div>
                        <div class="form-group col-md-3"><label>Час на відповідь (сек, 0=∞)</label><input type="number" class="form-control time-limit-seconds" value="0" min="0"></div>
                    </div>
                    <label>Варіанти відповідей (мін. 2, макс. 8, позначте правильні):</label>
                    <div class="options-container">
                        ${[1, 2].map(i => addOption(questionCounter, i)).join('')}
                    </div>
                    <button type="button" class="btn btn-sm btn-outline-secondary mt-2 add-option-btn">Додати варіант</button>
                </div>
            </div>`;
        $('#questions-container').append(questionHtml);
    }

    function addOption(qId, oId) {
        return `<div class="input-group mb-2"><div class="input-group-prepend"><div class="input-group-text"><input type="checkbox" name="correct-answer-${qId}"></div></div><input type="text" class="form-control option-text" placeholder="Варіант ${oId}" required></div>`;
    }

    function handleSettingsDependencies() {
        const disallowReturn = $('#setting-disallow-return').is(':checked');
        $('#setting-allow-change-answer').prop('disabled', disallowReturn).prop('checked', !disallowReturn);
        const showScore = $('#setting-show-score').is(':checked');
        $('#setting-show-answers').prop('disabled', !showScore).prop('checked', showScore);
    }

    $('#setting-disallow-return, #setting-show-score').on('change', handleSettingsDependencies);

    $('#questions-container').on('click', '.add-option-btn', function() {
        const questionBlock = $(this).closest('.question-block');
        const qId = questionBlock.data('question-id');
        const optionsContainer = questionBlock.find('.options-container');
        const optionCount = optionsContainer.children().length;
        if (optionCount < 8) { optionsContainer.append(addOption(qId, optionCount + 1)); }
        else { alert('Максимум 8 варіантів відповідей.'); }
    });

    addQuestion();
    handleSettingsDependencies();

    $('#add-question-btn').on('click', addQuestion);

    $('#create-test-form').on('submit', function(e) {
        e.preventDefault();
        const settings = {
            disallowReturn: $('#setting-disallow-return').is(':checked'), allowChangeAnswer: $('#setting-allow-change-answer').is(':checked'),
            requireAnswer: $('#setting-require-answer').is(':checked'), shuffleQuestions: $('#setting-shuffle-questions').is(':checked'),
            shuffleAnswers: $('#setting-shuffle-answers').is(':checked'), uniqueAttempt: $('#setting-unique-attempt').is(':checked'),
            timeLimit: parseInt($('#setting-time-limit').val()) || 0, closeDate: $('#setting-close-date').val() || null,
            showScore: $('#setting-show-score').is(':checked'), showAnswers: $('#setting-show-answers').is(':checked')
        };
        const testPayload = { title: $('#test-title').val(), questions: [], settings };
        let isValid = true;
        $('.question-block').each(function() {
            const questionText = $(this).find('.question-text').val();
            if (!questionText) { alert('Текст питання не може бути порожнім.'); isValid = false; return false; }
            const timeLimitSeconds = parseInt($(this).find('.time-limit-seconds').val()) || 0;
            const options = [];
            const correct = [];
            $(this).find('.option-text').each(function(index) {
                const optionText = $(this).val();
                if (!optionText) { alert(`Текст варіанту відповіді у питанні "${questionText}" не може бути порожнім.`); isValid = false; return false; }
                options.push({ text: optionText, image: null });
                if ($(this).closest('.input-group').find('input[type=checkbox]').is(':checked')) { correct.push(index); }
            });
            if (!isValid) return false;
            if (options.length < 2) { alert(`У питанні "${questionText}" має бути мінімум 2 варіанти відповіді.`); isValid = false; return false; }
            if (correct.length === 0) { alert(`У питанні "${questionText}" не позначено жодної правильної відповіді.`); isValid = false; return false; }
            testPayload.questions.push({ q: questionText, image: null, timeLimitSeconds, multipleChoice: correct.length > 1, options, correct });
        });
        if (!isValid) return;
        fetch('/api/tests', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(testPayload)
        }).then(res => {
            if (!res.ok) { return res.json().then(err => Promise.reject(err)); }
            return res.json();
        }).then(data => {
            alert(`Тест "${data.title}" успішно створено!`);
            window.location.href = '/dashboard.html';
        }).catch(err => {
            alert('Помилка: ' + (err.message || 'Не вдалося зберегти тест.'));
        });
    });
});