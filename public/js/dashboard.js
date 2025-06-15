$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }

    function formatCountdown(endDate) {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;

        if (diff <= 0) return '<span class="text-danger">Закрито</span>';
        
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (d > 30) return `~${Math.floor(d/30)} міс.`;
        if (d > 0) return `${d} д. ${h} г.`;
        return `<span class="text-warning">${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}</span>`;
    }

    fetch('/api/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
        if (!res.ok) { localStorage.removeItem('authToken'); window.location.href = '/login.html'; }
        return res.json();
    }).then(data => {
        $('#username-display').text(`Вітаємо, ${data.username}!`);
        const tableBody = $('#tests-table-body');
        if (data.tests.length === 0) {
            tableBody.html('<tr><td colspan="5" class="text-center">У вас ще немає створених тестів.</td></tr>');
        } else {
            data.tests.forEach(test => {
                const status = test.settings.closeDate ? formatCountdown(test.settings.closeDate) : 'Відкрито';
                const row = `
                    <tr><td>${test.title}</td><td><code>${test.code}</code></td><td>${status}</td><td>${test.resultsCount}</td>
                    <td><a href="/results.html?code=${test.code}" class="btn btn-sm btn-info">Результати</a></td></tr>`;
                tableBody.append(row);
            });
        }
    });

    $('#logout-btn').on('click', function() {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
    });
});