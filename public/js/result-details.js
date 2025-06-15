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
        $('#participant-name').text(`Відповіді учасника: ${data.participantName}`);
        $('#submission-date').text(`Час проходження: ${new Date(data.submittedAt).toLocaleString('uk-UA')}`);

        const container = $('#details-container');
        data.detailedView.forEach((item, index) => {
            let optionsHtml = '';
            item.options.forEach((option, optIndex) => {
                let classes = '';
                const isCorrect = item.correct.includes(optIndex);
                const isUserAnswer = item.userAnswer.includes(optIndex);

                if (isCorrect) classes += 'option-correct ';
                if (isUserAnswer && isCorrect) classes += 'option-user-correct';
                else if (isUserAnswer && !isCorrect) classes += 'option-user-incorrect';
                
                optionsHtml += `<li class="list-group-item ${classes}">${option.text}</li>`;
            });

            const cardHtml = `
                <div class="card mt-3">
                    <div class="card-header">Питання ${index + 1}: ${item.q}</div>
                    <ul class="list-group list-group-flush">${optionsHtml}</ul>
                </div>
            `;
            container.append(cardHtml);
        });
    })
    .catch(err => { $('body').html(`<div class="alert alert-danger">Помилка: ${err.message || 'Не вдалося завантажити деталі.'}</div>`); });
});