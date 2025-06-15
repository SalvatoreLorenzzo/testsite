$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }
    const params = new URLSearchParams(window.location.search);
    const testCode = params.get('code');

    if (!testCode) { $('body').html('<div class="alert alert-danger">Код тесту не вказано.</div>'); return; }

    fetch(`/api/results/${testCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => { if (!res.ok) return res.json().then(err => Promise.reject(err)); return res.json(); })
    .then(data => {
        $('#test-title').text(`Результати тесту: "${data.title}"`);
        const tableBody = $('#results-table-body');
        if (data.results.length === 0) {
            tableBody.html('<tr><td colspan="3" class="text-center">Ще ніхто не пройшов цей тест.</td></tr>');
        } else {
            data.results.forEach(result => {
                const submittedDate = new Date(result.submittedAt).toLocaleString('uk-UA');
                const row = `
                    <tr data-result-id="${result.resultId}" style="cursor: pointer;">
                        <td>${result.participantName}</td>
                        <td><strong>${result.score} / ${result.total}</strong></td>
                        <td>${submittedDate}</td>
                    </tr>
                `;
                tableBody.append(row);
            });
        }
    })
    .catch(err => { $('body').html(`<div class="alert alert-danger">Помилка: ${err.message || 'Не вдалося завантажити результати.'}</div>`); });

    $('#results-table-body').on('click', 'tr', function() {
        const resultId = $(this).data('result-id');
        if(resultId) {
            window.location.href = `/result-details.html?id=${resultId}`;
        }
    });
});