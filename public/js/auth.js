$(document).ready(function() {
    const loginForm = $('#login-form form');
    const registerForm = $('#register-form form');
    
    // Ініціалізація табів Bootstrap
    $('#login-tab-link, #register-tab-link').on('click', function (e) {
        e.preventDefault();
        $(this).tab('show');
    });

    const alertBox = $('#alert-box');
    function showAlert(message, type) {
        alertBox.text(message).removeClass('alert-success alert-danger alert-info').addClass(`alert-${type}`).show();
    }

    loginForm.on('submit', function(e) {
        e.preventDefault();
        const username = $('#login-username').val();
        const password = $('#login-password').val();

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                window.location.href = '/dashboard.html';
            } else {
                showAlert(data.message || 'Помилка входу', 'danger');
            }
        })
        .catch(err => {
            console.error('Login Fetch Error:', err);
            showAlert('Не вдалося зв\'язатися з сервером.', 'danger');
        });
    });

    registerForm.on('submit', function(e) {
        e.preventDefault();
        const username = $('#register-username').val();
        const password = $('#register-password').val();

        let response;
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => {
            response = res;
            return res.json();
        })
        .then(data => {
            if (response.ok) {
                showAlert('Реєстрація успішна! Тепер можете увійти.', 'success');
                $('#login-tab-link').tab('show'); // Перемикаємо на вкладку входу
                $('#login-username').val(username);
                $('#login-password').val('').focus();
            } else {
                showAlert(data.message || 'Помилка реєстрації', 'danger');
            }
        })
        .catch(err => {
            console.error('Register Fetch Error:', err);
            showAlert('Не вдалося зв\'язатися з сервером.', 'danger');
        });
    });
});