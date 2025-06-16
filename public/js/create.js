$(document).ready(function() {
    // --- 1. ІНІЦІАЛІЗАЦІЯ ТА ГЛОБАЛЬНІ ЗМІННІ ---
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    let questionCounter = 0;
    let lightbox; // Глобальна змінна для лайтбоксу

    // --- 2. ДОПОМІЖНІ ФУНКЦІЇ ---

    // *** ОСЬ ТУТ КЛЮЧОВЕ ВИПРАВЛЕННЯ ***
    // Ця функція повністю перебудовує лайтбокс, що гарантує його роботу
    function refreshLightbox() {
        if (lightbox) {
            // Повністю знищуємо попередній екземпляр і його слухачі подій
            lightbox.destroy();
        }
        // Створюємо абсолютно новий екземпляр для ВСІХ актуальних посилань на сторінці
        lightbox = new SimpleLightbox('.image-preview-container a');
    }

    function transliterate(text) {
        const a = {"Ё":"YO","Й":"I","Ц":"TS","У":"U","К":"K","Е":"E","Н":"N","Г":"G","Ш":"SH","Щ":"SCH","З":"Z","Х":"H","Ъ":"","Ф":"F","Ы":"I","В":"V","А":"A","П":"P","Р":"R","О":"O","Л":"L","Д":"D","Ж":"ZH","Э":"E","Я":"Ya","Ч":"CH","С":"S","М":"M","И":"I","Т":"T","Ь":"","Б":"B","Ю":"YU","ё":"yo","й":"i","ц":"ts","у":"u","к":"k","е":"e","н":"n","г":"g","ш":"sh","щ":"sch","з":"z","х":"h","ъ":"","ф":"f","ы":"i","в":"v","а":"a","п":"p","р":"r","о":"o","л":"l","д":"d","ж":"zh","э":"e","я":"ya","ч":"ch","с":"s","м":"m","и":"i","т":"t","ь":"","б":"b","ю":"yu"};
        return text.split('').map(char => a[char] || char).join('').replace(/[^\w\d]/g, '_').replace(/__+/g, '_');
    }

    function renderImagePreview(file, inputElement) {
        const previewContainer = $(inputElement).closest('.image-preview-wrapper, .option-image-controls').find('.image-preview-container');
        previewContainer.empty();

        const reader = new FileReader();
        reader.onload = function(e) {
            const imageUrl = e.target.result;
            const link = $('<a>').attr('href', imageUrl);
            const img = $('<img>').attr('src', imageUrl).addClass('image-preview');
            const removeBtn = $('<button type="button" class="btn btn-sm btn-danger remove-preview-btn" title="Видалити зображення">×</button>');
            
            link.append(img);
            previewContainer.append(link).append(removeBtn);

            $(inputElement).data('fileObject', file);
            
            removeBtn.on('click', function() {
                previewContainer.empty();
                $(inputElement).val('').removeData('fileObject');
                // Перебудовуємо лайтбокс після видалення фото
                refreshLightbox();
            });
            
            // Перебудовуємо лайтбокс після додавання нового фото
            refreshLightbox();
        };
        reader.readAsDataURL(file);
    }
    
    // --- 3. РЕНДЕРИНГ ЕЛЕМЕНТІВ ФОРМИ ---

    function addQuestion(qData = null) {
        questionCounter++;
        const qIndex = Date.now();
        const questionHtml = `
            <div class="card question-block-card mt-4 animate__animated animate__fadeInUp" data-q-id="${qIndex}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5>Питання <span class="question-number">${questionCounter}</span></h5>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-question-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="card-body">
                    <div class="form-row">
                        <div class="form-group col-md-9"><label>Текст питання:</label><input type="text" class="form-control question-text" required></div>
                        <div class="form-group col-md-3"><label>Час (сек, 0=∞)</label><input type="number" class="form-control time-limit-seconds" value="0" min="0"></div>
                    </div>

                    <!-- !!! ДОДАНО БЛОК З НАЛАШТУВАННЯМ ПИТАННЯ !!! -->
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="form-group mb-0">
                            <label class="d-block">Зображення до питання</label>
                            <div class="image-preview-wrapper">
                                <label class="btn btn-sm btn-outline-info mb-0">
                                    <i class="far fa-image mr-1"></i> Додати фото
                                    <input type="file" class="d-none question-image" accept="image/*">
                                </label>
                                <div class="image-preview-container ml-2"></div>
                            </div>
                        </div>
                        <div class="custom-control custom-switch">
                            <input type="checkbox" class="custom-control-input multiple-choice-switch" id="multiple-choice-${qIndex}">
                            <label class="custom-control-label" for="multiple-choice-${qIndex}">Декілька правильних відповідей</label>
                        </div>
                    </div>

                    <hr>
                    <label class="font-weight-bold">Варіанти відповідей:</label>
                    <div class="options-container"></div>
                    <button type="button" class="btn btn-sm btn-secondary mt-2 add-option-btn"><i class="fas fa-plus mr-1"></i>Додати варіант</button>
                </div>
            </div>`;
        
        const newQuestion = $(questionHtml).appendTo('#questions-container');
        const optionsContainer = newQuestion.find('.options-container');

        const isMultiple = (qData && qData.multipleChoice) || false;
        newQuestion.find('.multiple-choice-switch').prop('checked', isMultiple);

        if (qData) {
            newQuestion.find('.question-text').val(qData.q);
            newQuestion.find('.time-limit-seconds').val(qData.timeLimitSeconds || 0);
            if (qData.imageFile) {
                renderImagePreview(qData.imageFile, newQuestion.find('.question-image'));
            }
            qData.options.forEach(optData => addOption(optionsContainer, isMultiple, optData));
        } else {
            addOption(optionsContainer, isMultiple);
            addOption(optionsContainer, isMultiple);
        }
        updateQuestionNumbers();
    }

    function addOption(container, isMultipleChoice, optData = null) {
        const inputType = isMultipleChoice ? 'checkbox' : 'radio';
        const qId = container.closest('.question-block-card').data('q-id');
        const optionHtml = `
            <div class="option-block mb-3">
                <div class="input-group">
                    <div class="input-group-prepend">
                        <div class="input-group-text">
                            <input type="${inputType}" name="correct-answer-${qId}" title="Правильна відповідь">
                        </div>
                    </div>
                    <input type="text" class="form-control option-text" placeholder="Текст варіанту" required>
                    <div class="input-group-append">
                        <button class="btn btn-outline-danger remove-option-btn" type="button" title="Видалити варіант">×</button>
                    </div>
                </div>
                <div class="option-image-controls mt-2">
                    <label class="btn btn-sm btn-outline-info mb-0">
                        <i class="far fa-image mr-1"></i> Додати фото до варіанту
                        <input type="file" class="d-none option-image" accept="image/*">
                    </label>
                    <div class="image-preview-container ml-2"></div>
                </div>
            </div>`;
        
        const newOption = $(optionHtml).appendTo(container);
        if (optData) {
            newOption.find('.option-text').val(optData.text);
            newOption.find(`input[type=${inputType}]`).prop('checked', optData.isCorrect);
            if (optData.imageFile) {
                renderImagePreview(optData.imageFile, newOption.find('.option-image'));
            }
        }
    }

    function updateQuestionNumbers() {
        $('.question-block-card').each(function(index) {
            $(this).find('.question-number').text(index + 1);
        });
    }

    // --- 4. ОБРОБНИКИ ПОДІЙ ІНТЕРФЕЙСУ ---
    
    $('#add-question-btn').on('click', () => {
        addQuestion();
        refreshLightbox();
    });

    $('#questions-container').on('click', '.remove-question-btn', function() {
        $(this).closest('.question-block-card').remove();
        updateQuestionNumbers();
        refreshLightbox();
    });

    $('#questions-container').on('click', '.add-option-btn', function() {
        const container = $(this).siblings('.options-container');
        addOption(container, false);
        refreshLightbox();
    });

    $('#questions-container').on('click', '.remove-option-btn', function() {
        $(this).closest('.option-block').remove();
        refreshLightbox();
    });

    $('#questions-container').on('change', '.question-image, .option-image', function(e) {
        const file = e.target.files[0];
        if (file) {
            renderImagePreview(file, this);
        }
    });

    function handleSettingsDependencies() {
        const disallowReturn = $('#setting-disallow-return').is(':checked');
        $('#setting-allow-change-answer').prop('disabled', disallowReturn).prop('checked', !disallowReturn);
        const showScore = $('#setting-show-score').is(':checked');
        $('#setting-show-answers').prop('disabled', !showScore).prop('checked', showScore);
    }
    $('#setting-disallow-return, #setting-show-score').on('change', handleSettingsDependencies);

    // --- 5. ЛОГІКА ІМПОРТУ/ЕКСПОРТУ ---

    function collectTestDataFromForm() {
        const testData = {
            title: $('#test-title').val().trim(),
            settings: {},
            questions: []
        };
        $('[id^="setting-"]').each(function() {
            const key = this.id.replace('setting-', '').replace(/-(\w)/g, (m, p1) => p1.toUpperCase());
            if ($(this).is(':checkbox')) testData.settings[key] = $(this).is(':checked');
            else testData.settings[key] = $(this).val();
        });
        
        $('.question-block-card').each(function() {
            const qElement = $(this);
            // !!! ЗЧИТУЄМО СТАН ПЕРЕМИКАЧА !!!
            const question = {
                q: qElement.find('.question-text').val().trim(),
                timeLimitSeconds: parseInt(qElement.find('.time-limit-seconds').val()) || 0,
                multipleChoice: qElement.find('.multiple-choice-switch').is(':checked'),
                image: null,
                options: [],
                correct: []
            };

            const qImageInput = qElement.find('.question-image');
            if ($(qImageInput).data('fileObject')) question.imageFile = $(qImageInput).data('fileObject');

            qElement.find('.option-block').each(function(oIndex) {
                const oElement = $(this);
                const option = {
                    text: oElement.find('.option-text').val().trim(),
                    image: null
                };
                
                const oImageInput = oElement.find('.option-image');
                if ($(oImageInput).data('fileObject')) option.imageFile = $(oImageInput).data('fileObject');
                
                if (oElement.find('input[type=checkbox]:checked, input[type=radio]:checked').length > 0) {
                    question.correct.push(oIndex);
                }
                question.options.push(option);
            });
            testData.questions.push(question);
        });
        return testData;
    }

    $('#export-btn').on('click', async function() {
        const button = $(this);
        button.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Експорт...');
        
        const testData = collectTestDataFromForm();
        if (!testData.title) {
            alert('Будь ласка, введіть назву тесту перед експортом.');
            button.prop('disabled', false).html('<i class="fas fa-file-export mr-2"></i>Експорт ZIP');
            return;
        }

        const zip = new JSZip();
        const imgFolder = zip.folder("images");
        const compressionOptions = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        
        const fileProcessingPromises = testData.questions.map(async (q, qIndex) => {
            if (q.imageFile) {
                const fileName = `${Date.now()}_q${qIndex}${path.extname(q.imageFile.name)}`;
                const compressedFile = await imageCompression(q.imageFile, compressionOptions);
                imgFolder.file(fileName, compressedFile);
                q.image = `images/${fileName}`;
            }
            delete q.imageFile;

            const optionPromises = q.options.map(async (opt, oIndex) => {
                if (opt.imageFile) {
                    const fileName = `${Date.now()}_q${qIndex}_o${oIndex}${path.extname(opt.imageFile.name)}`;
                    const compressedFile = await imageCompression(opt.imageFile, compressionOptions);
                    imgFolder.file(fileName, compressedFile);
                    opt.image = `images/${fileName}`;
                }
                delete opt.imageFile;
            });
            await Promise.all(optionPromises);
        });

        try {
            await Promise.all(fileProcessingPromises);
            zip.file("test.json", JSON.stringify(testData, null, 2));
            const content = await zip.generateAsync({type:"blob"});
            const safeFileName = transliterate(testData.title) || 'test';
            saveAs(content, `${safeFileName}.zip`);
        } catch (error) {
            alert('Помилка при створенні архіву.');
            console.error(error);
        } finally {
            button.prop('disabled', false).html('<i class="fas fa-file-export mr-2"></i>Експорт ZIP');
        }
    });

    $('#import-btn').on('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm('Імпорт тесту з архіву перезапише всі поточні дані. Продовжити?')) {
            $(this).val(''); return;
        }
        
        JSZip.loadAsync(file).then(async function(zip) {
            const testJsonFile = zip.file("test.json");
            if (!testJsonFile) throw new Error("Файл test.json не знайдено в архіві.");
            
            const content = await testJsonFile.async("string");
            const testData = JSON.parse(content);
            
            const imagePromises = [];
            testData.questions.forEach((q) => {
                if (q.image) {
                    const imageFile = zip.file(q.image);
                    if (imageFile) {
                        imagePromises.push(imageFile.async('blob').then(blob => {
                            // *** ОСЬ КЛЮЧОВА ЗМІНА ***
                            const newFile = new File([blob], imageFile.name.split('/').pop(), { type: blob.type });
                            newFile.isImported = true; // Додаємо маркер
                            q.imageFile = newFile;
                        }));
                    }
                }
                q.options.forEach((opt, oIndex) => {
                    if (opt.image) {
                        const imageFile = zip.file(opt.image);
                        if (imageFile) {
                            imagePromises.push(imageFile.async('blob').then(blob => {
                                // *** І ТУТ ТАКОЖ ***
                                const newFile = new File([blob], imageFile.name.split('/').pop(), { type: blob.type });
                                newFile.isImported = true; // Додаємо маркер
                                opt.imageFile = newFile;
                            }));
                        }
                    }
                    opt.isCorrect = q.correct.includes(oIndex);
                });
            });

            await Promise.all(imagePromises);
            populateFormWithData(testData);

        }).catch(err => alert(`Помилка імпорту: ${err.message}`))
        .finally(() => $(this).val(''));
    });
    
    function populateFormWithData(testData) {
        if (!testData.title || !testData.questions || !testData.settings) {
            alert('Некоректний формат JSON файлу.'); return;
        }
        
        $('#test-title').val(testData.title);
        for (const key in testData.settings) {
            const element = $(`#setting-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
            if (element.is(':checkbox')) element.prop('checked', testData.settings[key]);
            else element.val(testData.settings[key]);
        }
        handleSettingsDependencies();
        
        $('#questions-container').empty();
        questionCounter = 0;
        if (testData.questions.length > 0) {
            testData.questions.forEach(qData => addQuestion(qData));
        } else {
            addQuestion();
        }
        
        refreshLightbox();
    }


    // --- 6. ЛОГІКА ВІДПРАВКИ ФОРМИ (SUBMIT) ---
    $('#create-test-form').on('submit', async function(e) {
        e.preventDefault();
        
        const submitButton = $(this).find('button[type=submit]');
        submitButton.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Збереження...');

        const testPayload = collectTestDataFromForm();
        if (!testPayload.title || testPayload.questions.length === 0) {
            alert('Назва тесту та хоча б одне питання є обов\'язковими.');
            submitButton.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Зберегти тест');
            return;
        }
        
        const formData = new FormData();
        const fileProcessingPromises = [];
        const compressionOptions = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
        const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

        testPayload.questions.forEach((q, qIndex) => {
            if(q.imageFile) {
                if (q.imageFile.isImported || q.imageFile.size <= MAX_SIZE_BYTES) {
                    formData.append(`qImage-${qIndex}`, q.imageFile, q.imageFile.name);
                } else {
                    const promise = imageCompression(q.imageFile, compressionOptions)
                        .then(f => formData.append(`qImage-${qIndex}`, f, q.imageFile.name));
                    fileProcessingPromises.push(promise);
                }
            }
            delete q.imageFile;

            q.options.forEach((opt, oIndex) => {
                if(opt.imageFile) {
                    if (opt.imageFile.isImported || opt.imageFile.size <= MAX_SIZE_BYTES) {
                        formData.append(`oImage-${qIndex}-${oIndex}`, opt.imageFile, opt.imageFile.name);
                    } else {
                        const promise = imageCompression(opt.imageFile, compressionOptions)
                            .then(f => formData.append(`oImage-${qIndex}-${oIndex}`, f, opt.imageFile.name));
                        fileProcessingPromises.push(promise);
                    }
                }
                delete opt.imageFile;
            });
        });

        try {
            // Зачекаємо, поки всі великі файли стиснуться
            await Promise.all(fileProcessingPromises);
        } catch (error) {
            // Ця помилка тепер має зникнути для імпортованих файлів
            console.error('Помилка стиснення зображення:', error);
            alert('Помилка під час обробки зображень.');
            submitButton.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Зберегти тест');
            return;
        }

        formData.append('testData', JSON.stringify(testPayload));

        fetch('/api/tests', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        }).then(res => res.ok ? res.json() : res.json().then(err => Promise.reject(err)))
        .then(data => {
            alert(`Тест "${data.title}" успішно створено!`);
            window.location.href = '/dashboard.html';
        })
        .catch(err => {
            alert('Помилка: ' + (err.message || 'Не вдалося зберегти тест.'));
            submitButton.prop('disabled', false).html('<i class="fas fa-save mr-2"></i>Зберегти тест');
        });
    });

    $('#questions-container').on('click', '.image-preview-container a', function(e) {
    e.preventDefault();
    const allImages = $('#questions-container .image-preview-container a');
    const clickedIndex = allImages.index(this);
    new SimpleLightbox(allImages.get(), {
        startAtIndex: clickedIndex 
    }).open();

    });

    $('#questions-container').on('change', '.multiple-choice-switch', function() {
    const isChecked = $(this).is(':checked');
    const newType = isChecked ? 'checkbox' : 'radio';
    const questionCard = $(this).closest('.question-block-card');
    
    // Знаходимо всі інпути для відповідей у цьому питанні
    questionCard.find('.options-container input[type=radio], .options-container input[type=checkbox]').each(function() {
        // Змінюємо їх тип
        $(this).attr('type', newType);
    });

    // Якщо перемкнули на radio (одна відповідь), а було вибрано декілька,
    // залишаємо вибраною тільки першу.
    if (!isChecked) {
        const checkedOptions = questionCard.find('.options-container input:checked');
        if (checkedOptions.length > 1) {
            checkedOptions.not(':first').prop('checked', false);
        }
    }
    });


    // --- ІНІЦІАЛІЗАЦІЯ СТОРІНКИ ---
    const path = { extname: (p) => p.substring(p.lastIndexOf('.')) };
    addQuestion();
    handleSettingsDependencies();
    refreshLightbox();
});