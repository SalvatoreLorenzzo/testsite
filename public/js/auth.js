$(document).ready(function() {
    const loginForm = $('#login-form');
    const registerForm = $('#register-form');
    const loginTab = $('#login-tab-link');
    const registerTab = $('#register-tab-link');
    const alertBox = $('#alert-box');

    function showAlert(message, type) {
        alertBox.text(message).removeClass('alert-success alert-danger').addClass(`alert-${type}`).show();
    }

    loginTab.on('click', function(e) {
        e.preventDefault();
        $(this).addClass('active');
        registerTab.removeClass('active');
        loginForm.show();
        registerForm.hide();
        alertBox.hide();
    });

    registerTab.on('click', function(e) {
        e.preventDefault();
        $(this).addClass('active');
        loginTab.removeClass('active');
        registerForm.show();
        loginForm.hide();
        alertBox.hide();
    });

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
                loginTab.click();
                $('#login-username').val(username);
                $('#login-password').focus();
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