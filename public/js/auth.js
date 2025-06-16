$(document).ready(function() {
    // --- Елементи DOM ---
    const loginForm = $('#login-form form');
    const registerForm = $('#register-form form');
    const alertBox = $('#alert-box');

    const loginBtn = $('#login-submit-btn');
    const loginUsernameInput = $('#login-username');
    const loginPasswordInput = $('#login-password');

    const registerBtn = $('#register-submit-btn');
    const registerUsernameInput = $('#register-username');
    const registerPasswordInput = $('#register-password');

    // --- Логіка стану кнопок ---
    
    // Функція, що перевіряє заповненість полів і вмикає/вимикає кнопку
    function checkFormState(usernameInput, passwordInput, button) {
        const username = usernameInput.val().trim();
        const password = passwordInput.val().trim();

        // Кнопка буде активна, тільки якщо обидва поля не порожні
        if (username !== '' && password !== '') {
            button.prop('disabled', false);
        } else {
            button.prop('disabled', true);
        }
    }

    // Встановлюємо слухачі на введення тексту для обох форм
    loginUsernameInput.add(loginPasswordInput).on('keyup input', function() {
        checkFormState(loginUsernameInput, loginPasswordInput, loginBtn);
    });

    registerUsernameInput.add(registerPasswordInput).on('keyup input', function() {
        checkFormState(registerUsernameInput, registerPasswordInput, registerBtn);
    });

    // --- Ініціалізація сторінки ---

    // Ініціалізація табів Bootstrap
    $('#login-tab-link, #register-tab-link').on('click', function(e) {
        e.preventDefault();
        $(this).tab('show');
    });

    // Перевіряємо стан кнопок при першому завантаженні сторінки
    checkFormState(loginUsernameInput, loginPasswordInput, loginBtn);
    checkFormState(registerUsernameInput, registerPasswordInput, registerBtn);


    // --- Логіка відправки форм ---

    function showAlert(message, type) {
        alertBox.text(message).removeClass('alert-success alert-danger alert-info').addClass(`alert-${type}`).show();
    }

    loginForm.on('submit', function(e) {
        e.preventDefault();
        const username = loginUsernameInput.val();
        const password = loginPasswordInput.val();

        fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => {
            // Перевіряємо, чи відповідь успішна, інакше готуємо текст помилки
            if (!res.ok) {
                return res.json().then(err => Promise.reject(err));
            }
            return res.json();
        })
        .then(data => {
            if (data.token) {
                localStorage.setItem('authToken', data.token);
                window.location.href = '/dashboard.html';
            }
        })
        .catch(err => {
            console.error('Login Fetch Error:', err);
            // Використовуємо повідомлення з сервера, якщо воно є
            showAlert(err.message || 'Не вдалося зв\'язатися з сервером.', 'danger');
        });
    });

    registerForm.on('submit', function(e) {
        e.preventDefault();
        const username = registerUsernameInput.val();
        const password = registerPasswordInput.val();

        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(err => Promise.reject(err));
            }
            return res.json();
        })
        .then(data => {
            showAlert('Реєстрація успішна! Тепер можете увійти.', 'success');
            $('#login-tab-link').tab('show');
            loginUsernameInput.val(username);
            loginPasswordInput.val('').focus();
            // Оновлюємо стан кнопок після переключення
            checkFormState(loginUsernameInput, loginPasswordInput, loginBtn);
            checkFormState(registerUsernameInput, registerPasswordInput, registerBtn);
        })
        .catch(err => {
            console.error('Register Fetch Error:', err);
            showAlert(err.message || 'Не вдалося зв\'язатися з сервером.', 'danger');
        });
    });
});