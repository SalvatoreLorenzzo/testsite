$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }
    const params = new URLSearchParams(window.location.search);
    const testCode = params.get('code');
    let allResultsData = [];
    let testTitle = '';

    if (!testCode) { $('body').html('<div class="alert alert-danger">Код тесту не вказано.</div>'); return; }

    function renderTable(results) {
        const tableBody = $('#results-table-body');
        tableBody.empty();
        if (results.length === 0) {
            $('#no-results-placeholder').show();
            $('.table-responsive').hide();
        } else {
            $('#no-results-placeholder').hide();
            $('.table-responsive').show();
            results.forEach(result => {
                const submittedDate = new Date(result.submittedAt).toLocaleString('uk-UA');
                const scorePercentage = (result.score / result.total) * 100;
                let progressBarClass = 'bg-success';
                if (scorePercentage < 75) progressBarClass = 'bg-warning';
                if (scorePercentage < 50) progressBarClass = 'bg-danger';

                const resultHtml = `
                    <tr data-result-id="${result.resultId}">
                        <td data-label="Учасник"><span class="participant-name">${result.participantName}</span></td>
                        <td data-label="Результат">
                            <div class="d-flex align-items-center">
                                <span class="result-score mr-3">${result.score}/${result.total}</span>
                                <div class="progress result-progress flex-grow-1"><div class="progress-bar ${progressBarClass}" style="width: ${scorePercentage}%"></div></div>
                            </div>
                        </td>
                        <td data-label="Дата">${submittedDate}</td>
                        <td data-label="Дії">
                            <button class="btn btn-sm btn-outline-danger delete-result-btn" title="Видалити результат"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
                tableBody.append(resultHtml);
            });
        }
    }

    fetch(`/api/results/${testCode}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => { if (!res.ok) return res.json().then(err => Promise.reject(err)); return res.json(); })
    .then(data => {
        testTitle = data.title;
        $('#test-title-sub').text(testTitle);
        allResultsData = data.results;
        renderTable(allResultsData);
    })
    .catch(err => { $('body').html(`<div class="alert alert-danger">Помилка: ${err.message || 'Не вдалося завантажити результати.'}</div>`); });

    $('#results-table-body').on('click', 'tr', function(e) {
        if ($(e.target).closest('.delete-result-btn').length > 0) return;
        const resultId = $(this).data('result-id'); // Ось тут ми беремо ID
        if(resultId) { 
            window.location.href = `/result-details.html?id=${resultId}`; // І вставляємо в URL
        }
    });
    
    $('#results-table-body').on('click', '.delete-result-btn', function(e) {
        e.stopPropagation();
        const row = $(this).closest('tr');
        const resultId = row.data('result-id');
        if (confirm('Ви впевнені, що хочете видалити цей результат?')) {
            fetch(`/api/results/${resultId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            }).then(res => {
                if (res.ok) {
                    row.remove();
                    allResultsData = allResultsData.filter(r => r.resultId !== resultId);
                } else {
                    alert('Помилка видалення.');
                }
            });
        }
    });

    $('#confirm-export-btn').on('click', async function() {
        const format = $('input[name="format"]:checked').val();
        const isDetailed = $('#detail-level-switch').is(':checked');
        
        try {
            const res = await fetch(`/api/export/${testCode}`, { headers: { 'Authorization': `Bearer ${token}` }});
            if (!res.ok) throw new Error('Не вдалося отримати дані для експорту');
            const data = await res.json();

            let fileContent, fileName, fileType;

            if (format === 'txt') {
                fileContent = `Результати тесту: "${data.title}"\n\n`;
                data.results.forEach(r => {
                    fileContent += `Учасник: ${r.participantName}\n`;
                    fileContent += `Результат: ${r.score}/${r.total}\n`;
                    fileContent += `Дата: ${new Date(r.submittedAt).toLocaleString('uk-UA')}\n`;
                    if (isDetailed) {
                        r.details.forEach((d, i) => {
                            fileContent += `  П${i+1}: ${d.question}\n`;
                            fileContent += `    -> Ваша відповідь: ${d.userAnswers.join(', ') || 'немає'}\n`;
                            fileContent += `    -> Правильна: ${d.correctAnswers.join(', ')}\n`;
                        });
                    }
                    fileContent += '-------------------------------------\n';
                });
                fileName = `${data.title}.txt`;
                fileType = 'text/plain;charset=utf-8';
            } else if (format === 'json') {
                const dataToExport = isDetailed ? data.results : data.results.map(({details, ...rest}) => rest);
                fileContent = JSON.stringify(dataToExport, null, 2);
                fileName = `${data.title}.json`;
                fileType = 'application/json;charset=utf-8';
            } else if (format === 'xlsx') {
                let worksheetData = [];
                if (isDetailed) {
                    worksheetData.push(['Учасник', 'Результат', 'Дата', 'Питання', 'Відповідь учасника', 'Правильна відповідь', 'Коректно?']);
                    data.results.forEach(r => {
                        r.details.forEach(d => {
                            worksheetData.push([r.participantName, `${r.score}/${r.total}`, new Date(r.submittedAt), d.question, d.userAnswers.join(', '), d.correctAnswers.join(', '), d.isCorrect ? 'Так' : 'Ні']);
                        });
                    });
                } else {
                    worksheetData.push(['Учасник', 'Результат (бали)', 'Всього питань', 'Дата']);
                    data.results.forEach(r => {
                        worksheetData.push([r.participantName, r.score, r.total, new Date(r.submittedAt)]);
                    });
                }
                const wb = XLSX.utils.book_new();
                const ws = XLSX.utils.aoa_to_sheet(worksheetData);
                XLSX.utils.book_append_sheet(wb, ws, "Результати");
                XLSX.writeFile(wb, `${data.title}.xlsx`);
                $('#exportModal').modal('hide');
                return;
            }

            const blob = new Blob([fileContent], { type: fileType });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            $('#exportModal').modal('hide');

        } catch (error) {
            alert(error.message);
        }
    });
});