$(document).ready(function() {
    const token = localStorage.getItem('authToken');
    if (!token) { window.location.href = '/login.html'; return; }

    let testToDelete = { code: null, title: null, cardElement: null };

    function formatCountdown(endDate) {
        if (!endDate) return '<span class="badge badge-pill badge-success">Відкрито</span>';
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;
        if (diff <= 0) return '<span class="badge badge-pill badge-danger">Закрито</span>';
        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        if (d > 0) return `<span class="badge badge-pill badge-info">Залишилось: ${d}д ${h}г</span>`;
        return `<span class="badge badge-pill badge-warning">Залишилось: ${h}г</span>`;
    }

    fetch('/api/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
        if (!res.ok) { localStorage.removeItem('authToken'); window.location.href = '/login.html'; }
        return res.json();
    }).then(data => {
        $('#username-display').text(data.username);
        const testsGrid = $('#tests-grid');
        
        if (data.tests.length === 0) {
            $('#no-tests-placeholder').show();
        } else {
            data.tests.forEach((test, index) => {
                const status = formatCountdown(test.settings.closeDate);
                // --- ЗМІНА ТУТ: Кнопка "Налаштування" видалена ---
                const cardHtml = `
                    <div class="col-12 col-lg-6 col-xl-4 mb-4 animate__animated animate__fadeInUp" style="animation-delay: ${index * 100}ms;" data-test-code="${test.code}">
                        <div class="card test-card h-100">
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title mb-3">${test.title}</h5>
                                <p class="card-text text-muted">Код: <code>${test.code}</code> 
                                    <i class="fas fa-copy copy-code-btn" data-toggle="tooltip" title="Копіювати код"></i>
                                </p>
                                <div class="d-flex justify-content-between text-muted mt-auto pt-3 test-info">
                                    <span><i class="fas fa-user-check mr-1"></i>${test.resultsCount}</span>
                                    <span>${status}</span>
                                </div>
                            </div>
                            <div class="card-footer d-flex justify-content-between">
                                <a href="/results.html?code=${test.code}" class="btn btn-primary btn-sm">Результати</a>
                                <div>
                                    <!-- <button class="btn btn-secondary btn-sm" disabled>Налаштування</button> -->
                                    <button class="btn btn-danger btn-sm delete-btn" data-toggle="modal" data-target="#deleteConfirmModal"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                testsGrid.append(cardHtml);
            });
            $('[data-toggle="tooltip"]').tooltip({ trigger: 'hover' });
        }
    });

    $('#tests-grid').on('click', '.copy-code-btn', function() {
        const code = $(this).siblings('code').text();
        navigator.clipboard.writeText(code).then(() => {
            $(this).attr('data-original-title', 'Скопійовано!').tooltip('show');
        });
    }).on('mouseleave', '.copy-code-btn', function() {
        $(this).attr('data-original-title', 'Копіювати код');
    });

    $('#tests-grid').on('click', '.delete-btn', function() {
        const card = $(this).closest('.col-12');
        testToDelete.cardElement = card;
        testToDelete.code = card.data('test-code');
        testToDelete.title = card.find('.card-title').text();
        $('#test-to-delete-title').text(testToDelete.title);
    });

    $('#confirm-delete-btn').on('click', function() {
        if (!testToDelete.code) return;
        fetch(`/api/tests/${testToDelete.code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => {
            if(res.ok) {
                testToDelete.cardElement.remove();
                $('#deleteConfirmModal').modal('hide');
            } else {
                alert('Помилка видалення тесту.');
            }
        });
    });

    $('#logout-btn').on('click', function() {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
    });
});