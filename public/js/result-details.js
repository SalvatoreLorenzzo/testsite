$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }
    const params = new URLSearchParams(window.location.search);
    const resultId = params.get('id');

    if (!resultId) { $('body').html('<div class="alert alert-danger">ID результату не вказано.</div>'); return; }

    fetch(`/api/results/details/${resultId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => { if (!res.ok) return res.json().then(err => Promise.reject(err)); return res.json(); })
    .then(data => {
        const { participantName, submittedAt, detailedResult, score, total } = data;

        $('#participant-name').text(`Відповіді: ${participantName}`);
        $('#submission-date').text(`Загальний результат: ${score}/${total} (${((score/total)*100).toFixed(1)}%) | ${new Date(submittedAt).toLocaleString('uk-UA')}`);

        const container = $('#details-container');
        if (!detailedResult) {
            container.html('<p class="text-muted">Детальна інформація для цього тесту не збережена.</p>');
            return;
        }

        detailedResult.forEach((item, index) => {
            let optionsHtml = '';
            item.options.forEach((option, optIndex) => {
                let liClasses = 'list-group-item d-flex align-items-center';
                let iconHtml = '';
                
                const isCorrect = item.correctAnswers.includes(optIndex);
                const isUserAnswer = item.userAnswers.includes(optIndex);

                if (isCorrect) {
                    iconHtml = '<i class="answer-icon correct fas fa-check"></i>';
                }

                if (isUserAnswer) {
                    liClasses += isCorrect ? ' answer-user-correct' : ' answer-user-incorrect';
                    if(!isCorrect){
                        iconHtml = '<i class="answer-icon incorrect fas fa-times"></i>';
                    }
                }
                
                const imageHtml = option.image ? `<div class="option-image-container"><a href="${option.image}"><img src="${option.image}" class="result-image"></a></div>` : '';
                optionsHtml += `<li class="${liClasses}">${iconHtml}${imageHtml}${option.text}</li>`;
            });

            const questionImageHtml = item.image ? `<div class="question-image-container"><a href="${item.image}"><img src="${item.image}" class="question-image-display"></a></div>` : '';
            
            const cardResultClass = item.questionScore >= 0.99 ? 'is-correct-card' : (item.questionScore > 0 ? 'is-partially-correct-card' : 'is-incorrect-card');

            const cardHtml = `
                <div class="card answer-card mt-4 ${cardResultClass}">
                    <div class="card-header">
                        <h5>Питання ${index + 1}: ${item.q}</h5>
                    </div>
                    <div class="card-body">
                        ${questionImageHtml}
                        <ul class="list-group list-group-flush">${optionsHtml}</ul>
                    </div>
                    <div class="card-footer text-right">
                        Набрано: ${item.questionScore} з 1
                    </div>
                </div>
            `;
            container.append(cardHtml);
        });

        new SimpleLightbox('#details-container a');
    })
    .catch(err => { $('body').html(`<div class="alert alert-danger">Помилка: ${err.message || 'Не вдалося завантажити деталі.'}</div>`); });
});