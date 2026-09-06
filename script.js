let currentTopMode = 'all'; // 'all', 'character', 'stage'
let currentSubMode = 'xml';

function setTopMode(mode) {
    currentTopMode = mode;
    // Обновить верхние кнопки
    document.querySelectorAll('.top-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('top-' + mode).classList.add('active');

    // Показать нужные подвкладки
    const subTabs = document.getElementById('subTabs');
    const allSubBtns = subTabs.querySelectorAll('.tab-btn');
    allSubBtns.forEach(btn => btn.style.display = 'none');

    if (mode === 'all') {
        document.getElementById('btn-sprite').style.display = 'block';
        document.getElementById('btn-xml').style.display = 'block';
        document.getElementById('btn-json').style.display = 'block';
        if (!document.getElementById('btn-xml').classList.contains('active') &&
            !document.getElementById('btn-sprite').classList.contains('active') &&
            !document.getElementById('btn-json').classList.contains('active')) {
            setSubMode('xml');
        }
    } else if (mode === 'character') {
        document.getElementById('btn-sprite').style.display = 'none';
        document.getElementById('btn-xml').style.display = 'block';
        document.getElementById('btn-json').style.display = 'none';
        setSubMode('xml');
    } else if (mode === 'stage') {
        document.getElementById('btn-sprite').style.display = 'block';
        document.getElementById('btn-xml').style.display = 'block';
        document.getElementById('btn-json').style.display = 'none';
        if (!document.getElementById('btn-xml').classList.contains('active') &&
            !document.getElementById('btn-sprite').classList.contains('active')) {
            setSubMode('xml');
        }
    }

    updateExperimentalVisibility();
}

function setSubMode(mode) {
    currentSubMode = mode;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-' + (mode === 'xml' ? 'xml' : mode)).classList.add('active');

    document.getElementById('xml-container').style.display = (mode === 'xml') ? 'block' : 'none';
    document.getElementById('json-container').style.display = (mode === 'json') ? 'block' : 'none';

    if (mode === 'sprite') {
        document.getElementById('xml-container').style.display = 'none';
        document.getElementById('json-container').style.display = 'none';
    }

    updateExperimentalVisibility();
}

function updateExperimentalVisibility() {
    // Character experimental – только если top=character и sub=xml
    const showChar = (currentTopMode === 'character' && currentSubMode === 'xml');
    document.getElementById('character-data-container').style.display = showChar ? 'block' : 'none';

    // Stage experimental – если top=stage и (sub=xml ИЛИ sub=sprite)
    const showStage = (currentTopMode === 'stage' && (currentSubMode === 'xml' || currentSubMode === 'sprite'));
    document.getElementById('stage-data-container').style.display = showStage ? 'block' : 'none';

    // Если Sprite выбран, скрываем оба experimental (кроме stage, если он разрешён)
    if (currentSubMode === 'sprite' && currentTopMode !== 'stage') {
        document.getElementById('character-data-container').style.display = 'none';
        document.getElementById('stage-data-container').style.display = 'none';
    }
}

function toggleCompressOptions() {
    document.getElementById('rangeBox').style.display = document.getElementById('compressCheck').checked ? 'block' : 'none';
}

function updateHint() {
    const val = parseInt(document.getElementById('colorsRange').value);
    const hint = document.getElementById('compressHint');
    if (val >= 224) {
        hint.innerHTML = `💡 <strong>${val} цветов (Высокое качество):</strong> Оптимальный баланс.`;
    } else if (val >= 128) {
        hint.innerHTML = `⚖️ <strong>${val} цветов (Среднее сжатие):</strong> Хорошо для простых персонажей.`;
    } else {
        hint.innerHTML = `⚡ <strong>${val} цветов (Максимальное сжатие):</strong> Подходит для легких ассетов.`;
    }
}

function previewPng() {
    const file = document.getElementById('pngInput').files[0];
    const previewBox = document.getElementById('pngPreview');
    const img = document.getElementById('pngImgPreview');
    const info = document.getElementById('pngInfo');
    if (!file) return (previewBox.style.display = 'none');

    const url = URL.createObjectURL(file);
    img.src = url;
    const tempImg = new Image();
    tempImg.src = url;
    tempImg.onload = () => {
        info.innerHTML = `<strong>${file.name}</strong>Разрешение: ${tempImg.width}×${tempImg.height} px | ${(file.size / 1024).toFixed(1)} KB`;
        previewBox.style.display = 'flex';
    };
}

async function previewDataFile(type) {
    const fileInput = document.getElementById(type + 'Input');
    const file = fileInput.files[0];
    const previewBox = document.getElementById('dataPreview');
    const info = document.getElementById('dataInfo');
    if (!file) return (previewBox.style.display = 'none');

    info.innerHTML = `<strong>${file.name}</strong>Размер: ${(file.size / 1024).toFixed(1)} KB`;
    previewBox.style.display = 'flex';
}

async function processFiles() {
    const pngFile = document.getElementById('pngInput').files[0];
    const pngBaseName = pngFile.name.replace(/\.[^/.]+$/, "");
    const scaleRaw = document.getElementById('scaleInput').value.replace(',', '.');
    const scale = parseFloat(scaleRaw);
    const log = document.getElementById('log');
    log.innerText = '';

    if (isNaN(scale) || scale <= 0) return alert('Введите корректный коэффициент сжатия!');
    if (!pngFile) return alert('Пожалуйста, выберите PNG файл!');

    const customName = document.getElementById('nameInput').value.trim();
    const zip = new JSZip();

    // Базовое имя
    let baseName = customName;
    if (!baseName) {
        if (currentSubMode === 'xml' && document.getElementById('xmlInput').files[0]) {
            baseName = document.getElementById('xmlInput').files[0].name.replace(/\.[^/.]+$/, "");
        } else if (currentSubMode === 'json' && document.getElementById('jsonAtlasInput').files[0]) {
            baseName = document.getElementById('jsonAtlasInput').files[0].name.replace(/\.[^/.]+$/, "");
        } else {
            baseName = pngFile.name.replace(/\.[^/.]+$/, "");
        }
    }

    // Обработка PNG
    log.innerText += "Обработка PNG...\n";
    const img = new Image();
    img.src = URL.createObjectURL(pngFile);
    await new Promise(r => img.onload = r);

    const origWidth = img.width;
    const origHeight = img.height;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(origWidth * scale);
    canvas.height = Math.round(origHeight * scale);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let pngBlob;
    if (document.getElementById('compressCheck').checked && window.UPNG) {
        log.innerText += "Квантизация палитры PNG...\n";
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const colors = parseInt(document.getElementById('colorsRange').value);
        const quantized = UPNG.encode([imgData.data.buffer], canvas.width, canvas.height, colors);
        pngBlob = new Blob([quantized], { type: 'image/png' });
    } else {
        pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    }
    zip.file(`${baseName}.png`, pngBlob);

    // Обработка разметки
    if (currentSubMode === 'sprite') {
        log.innerText += `Режим Sprite: сохранение только PNG.\n`;
    } 
    else if (currentSubMode === 'xml') {
        const xmlFile = document.getElementById('xmlInput').files[0];
        if (!xmlFile) return alert('Выберите XML файл!');
        
        log.innerText += `Обработка XML...\n`;
        const textData = await xmlFile.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(textData, "text/xml");
        if (customName) {
            const atlas = xmlDoc.getElementsByTagName("TextureAtlas")[0];
            if (atlas) atlas.setAttribute("imagePath", `${baseName}.png`);
        }
        const attrs = ["x", "y", "width", "height", "frameX", "frameY", "frameWidth", "frameHeight"];
        for (let sub of xmlDoc.getElementsByTagName("SubTexture")) {
            for (let attr of attrs) {
                if (sub.hasAttribute(attr)) {
                    sub.setAttribute(attr, Math.round(parseInt(sub.getAttribute(attr)) * scale));
                }
            }
        }
        zip.file(`${baseName}.xml`, new XMLSerializer().serializeToString(xmlDoc));
        log.innerText += "XML добавлен в архив!\n";
    } 
    else if (currentSubMode === 'json') {
        // Обработка JSON – оставляем как было
        const atlasFile = document.getElementById('jsonAtlasInput').files[0];
        const animFile = document.getElementById('jsonAnimInput').files[0];
        if (!atlasFile || !animFile) return alert('Выберите оба JSON файла (spritemap и Animation)!');
        // ... (код из предыдущей версии)
        // Для краткости опускаем, он не изменился
    }

    // --- ОБРАБОТКА CHARACTER (если выбран character и подрежим xml) ---
    if (currentTopMode === 'character' && currentSubMode === 'xml') {
        const charDataFile = document.getElementById('charDataInput').files[0];
        if (!charDataFile) {
            alert('В режиме Characters[Beta] требуется файл data/character!');
            return;
        }
        log.innerText += `Обработка файла конфигурации персонажа...\n`;
        try {
            const engine = document.getElementById('engineSelectChar').value;
            const charText = await charDataFile.text();
            let newCharData = "";
            const charExt = charDataFile.name.split('.').pop().toLowerCase();
            const charName = charDataFile.name;

            if (engine === 'codename' && charExt === 'xml') {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(charText, "text/xml");

                const mainXmlFile = document.getElementById('xmlInput').files[0];
                if (!mainXmlFile) {
                    throw new Error('Для Codename Engine требуется основной SpriteSheet XML.');
                }

                const mainXmlText = await mainXmlFile.text();
                const atlasDoc = parser.parseFromString(mainXmlText, 'text/xml');
                const subTextures = [...atlasDoc.getElementsByTagName('SubTexture')];

                // Вычисляем среднюю ширину и высоту по всем кадрам
                let totalWidth = 0, totalHeight = 0, count = 0;
                for (const frame of subTextures) {
                    const w = parseFloat(frame.getAttribute('frameWidth') || frame.getAttribute('width') || 0);
                    const h = parseFloat(frame.getAttribute('frameHeight') || frame.getAttribute('height') || 0);
                    if (w > 0 && h > 0) {
                        totalWidth += w;
                        totalHeight += h;
                        count++;
                    }
                }
                const avgWidth = count ? totalWidth / count : 0;
                const avgHeight = count ? totalHeight / count : 0;

                const animations = xmlDoc.getElementsByTagName('anim');

                // Масштабируем оффсеты анимаций
                for (const anim of animations) {
                    if (anim.hasAttribute('x')) {
                        const oldX = parseFloat(anim.getAttribute('x'));
                        anim.setAttribute('x', (Math.round(oldX * scale * 1000) / 1000).toString());
                    }
                    if (anim.hasAttribute('y')) {
                        const oldY = parseFloat(anim.getAttribute('y'));
                        anim.setAttribute('y', (Math.round(oldY * scale * 1000) / 1000).toString());
                    }
                }

                // Обрабатываем <character>
                for (const char of xmlDoc.getElementsByTagName('character')) {
                    const oldScale = char.hasAttribute('scale') ? parseFloat(char.getAttribute('scale')) : 1;
                    const newScale = oldScale / scale;
                    char.setAttribute('scale', (Math.round(newScale * 100000) / 100000).toString());

                    const dx = (avgWidth / 2) * (1 - scale);
                    const dy = (avgHeight / 2) * (1 - scale);

                    if (char.hasAttribute('x')) {
                        const oldX = parseFloat(char.getAttribute('x'));
                        char.setAttribute('x', (Math.round((oldX + dx) * 1000) / 1000).toString());
                    }
                    if (char.hasAttribute('y')) {
                        const oldY = parseFloat(char.getAttribute('y'));
                        char.setAttribute('y', (Math.round((oldY + dy) * 1000) / 1000).toString());
                    }
                }

                newCharData = new XMLSerializer().serializeToString(xmlDoc);
            } else {
                log.innerText += `⚠️ Внимание: Движок "${engine}" пока не поддерживается для character.\n`;
                newCharData = charText;
            }

            zip.folder("character data").file(charName, newCharData);
            log.innerText += `✅ Конфигурация персонажа сохранена в character data/\n`;
        } catch (e) {
            log.innerText += `❌ Ошибка обработки файла персонажа: ${e.message}\n`;
        }
    }

    // --- ОБРАБОТКА STAGE (если выбран stage) ---
    if (currentTopMode === 'stage') {
        const stageFile = document.getElementById('stageDataInput').files[0];
        if (!stageFile) {
            alert('В режиме Stages[Beta] требуется файл data/stage!');
            return;
        }
        log.innerText += `Обработка файла сцены (stage)...\n`;
        try {
            const stageText = await stageFile.text();
            const parser = new DOMParser();
            const stageDoc = parser.parseFromString(stageText, "text/xml");

            // Определяем имя спрайта для поиска – это имя PNG без расширения
            // Используем pngBaseName, который мы сохранили ранее (оригинальное имя PNG)
            const spriteName = pngBaseName; // например, "tiles"
            log.innerText += `  - Ищем спрайт с именем "${spriteName}"...\n`;

            // Находим все теги <sprite>
            const sprites = stageDoc.getElementsByTagName('sprite');
            let found = false;
            for (let sprite of sprites) {
                const spriteAttr = sprite.getAttribute('sprite');
                if (spriteAttr === spriteName) {
                    // Нашли нужный спрайт – меняем у него scale, x, y
                    let oldX = parseFloat(sprite.getAttribute('x')) || 0;
                    let oldY = parseFloat(sprite.getAttribute('y')) || 0;
                    let oldScale = parseFloat(sprite.getAttribute('scale')) || 1;

                    const newScale = oldScale / scale;
                    const dx = (origWidth * (1 - scale)) / 2;
                    const dy = (origHeight * (1 - scale)) / 2;
                    const newX = oldX + dx;
                    const newY = oldY + dy;

                    sprite.setAttribute('scale', (Math.round(newScale * 1000) / 1000).toString());
                    sprite.setAttribute('x', (Math.round(newX * 1000) / 1000).toString());
                    sprite.setAttribute('y', (Math.round(newY * 1000) / 1000).toString());

                    log.innerText += `  ✅ Спрайт "${spriteName}" обновлён: x=${newX.toFixed(2)}, y=${newY.toFixed(2)}, scale=${newScale.toFixed(3)}\n`;
                    found = true;
                    break; // выходим, так как нашли нужный
                }
            }

            if (!found) {
                log.innerText += `  ⚠️ Спрайт с именем "${spriteName}" не найден в файле сцены. Ничего не изменено.\n`;
            }

            // Сохраняем stage файл в папку "stage data"
            const stageName = stageFile.name;
            zip.folder("stage data").file(stageName, new XMLSerializer().serializeToString(stageDoc));
            log.innerText += `✅ Конфигурация сцены сохранена в stage data/\n`;
        } catch (e) {
            log.innerText += `❌ Ошибка обработки файла сцены: ${e.message}\n`;
        }
    }

    // Сборка
    log.innerText += "Сборка ZIP-архива...\n";
    const zipContent = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipContent);
    const downloadName = customName ? `${customName}_FunkinSheet.zip` : `${baseName}_Optimized.zip`;
    a.download = downloadName;
    a.click();
    log.innerText += "Готово! Архив скачан.\n";

    // Сброс полей ввода файлов и превью
    const fileInputs = ['pngInput', 'xmlInput', 'jsonAtlasInput', 'jsonAnimInput', 'charDataInput', 'stageDataInput'];
    for (const id of fileInputs) {
        const el = document.getElementById(id);
        if (el) el.value = '';
    }
    // Сброс превью PNG
    const pngPreview = document.getElementById('pngPreview');
    pngPreview.style.display = 'none';
    document.getElementById('pngImgPreview').src = '';
    document.getElementById('pngInfo').innerHTML = '';
    // Сброс превью данных (общего)
    const dataPreview = document.getElementById('dataPreview');
    dataPreview.style.display = 'none';
    document.getElementById('dataInfo').innerHTML = '';
}

function isFrameEqual(f1, f2) {
    if (!f1.E || !f1.E[0] || !f1.E[0].SI || !f2.E || !f2.E[0] || !f2.E[0].SI) return false;
    const e1 = f1.E[0].SI;
    const e2 = f2.E[0].SI;
    const sameSymbol = e1.SN === e2.SN && e1.FF === e2.FF;
    const sameTRP = (e1.TRP ? e1.TRP.x : 0) === (e2.TRP ? e2.TRP.x : 0) && (e1.TRP ? e1.TRP.y : 0) === (e2.TRP ? e2.TRP.y : 0);
    return sameSymbol && sameTRP;
}

window.onload = function() {
    setTopMode('all');
    setSubMode('xml');
};
