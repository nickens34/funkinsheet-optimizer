let currentMode = 'xml';

function setMode(mode) {
    currentMode = mode;
    document.getElementById('xml-container').style.display = (mode === 'xml') ? 'block' : 'none';
    document.getElementById('json-container').style.display = (mode === 'json') ? 'block' : 'none';
    
    document.getElementById('btn-sprite').className = 'tab-btn ' + (mode === 'sprite' ? 'active' : '');
    document.getElementById('btn-xml').className = 'tab-btn ' + (mode === 'xml' ? 'active' : '');
    document.getElementById('btn-json').className = 'tab-btn ' + (mode === 'json' ? 'active' : '');

    document.getElementById('character-data-container').style.display = (mode === 'sprite' || mode === 'json') ? 'none' : 'block';
    
    // Прячем превьюшку данных, если перешли в Sprite
    if (mode === 'sprite') {
        document.getElementById('dataPreview').style.display = 'none';
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
    const scaleRaw = document.getElementById('scaleInput').value.replace(',', '.');
    const scale = parseFloat(scaleRaw);
    const log = document.getElementById('log');
    log.innerText = '';

    if (isNaN(scale) || scale <= 0) return alert('Введите корректный коэффициент сжатия!');
    if (!pngFile) return alert('Пожалуйста, выберите PNG файл!');

    const customName = document.getElementById('nameInput').value.trim();
    const zip = new JSZip();

    // Определяем базовое имя
    let baseName = customName;
    if (!baseName) {
        if (currentMode === 'xml' && document.getElementById('xmlInput').files[0]) {
            baseName = document.getElementById('xmlInput').files[0].name.replace(/\.[^/.]+$/, "");
        } else if (currentMode === 'json' && document.getElementById('jsonAtlasInput').files[0]) {
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

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
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

    // Обработка разметки в зависимости от режима
    if (currentMode === 'sprite') {
        log.innerText += `Режим Sprite: сохранение только PNG.\n`;
    } 
    else if (currentMode === 'xml') {
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
    else if (currentMode === 'json') {
        const atlasFile = document.getElementById('jsonAtlasInput').files[0];
        const animFile = document.getElementById('jsonAnimInput').files[0];
        if (!atlasFile || !animFile) return alert('Выберите оба JSON файла (spritemap и Animation)!');

        log.innerText += `Обработка Spritemap JSON...\n`;
        try {
            // Обработка spritemap.json
            let atlasData = JSON.parse(await atlasFile.text());
            if (atlasData.meta) {
                if (customName) atlasData.meta.image = `${baseName}.png`;
                if (atlasData.meta.size) {
                    atlasData.meta.size.w = Math.round(atlasData.meta.size.w * scale);
                    atlasData.meta.size.h = Math.round(atlasData.meta.size.h * scale);
                }
            }
            if (atlasData.ATLAS && atlasData.ATLAS.SPRITES) {
                atlasData.ATLAS.SPRITES.forEach(item => {
                    if (item.sprite) {
                        ['x', 'y', 'w', 'h'].forEach(attr => {
                            if (item.sprite[attr] !== undefined) {
                                item.sprite[attr] = Math.round(item.sprite[attr] * scale);
                            }
                        });
                    }
                });
            }
            zip.file(`${baseName}.json`, JSON.stringify(atlasData, null, 0));

            // Обработка Animation.json
            log.innerText += `Оптимизация Animation JSON...\n`;
            let animData = JSON.parse(await animFile.text());
            let duplicatesRemoved = 0;

            if (animData.AN && animData.AN.TL && animData.AN.TL.L) {
                animData.AN.TL.L.forEach(layer => {
                    if (!layer.FR) return;
                    let optimizedFrames = [];
                    let currentFrame = null;

                    layer.FR.forEach(frame => {
                        if (frame.E && frame.E[0] && frame.E[0].SI && frame.E[0].SI.TRP) {
                            let trp = frame.E[0].SI.TRP;
                            trp.x = Math.round((trp.x * scale) * 1000) / 1000;
                            trp.y = Math.round((trp.y * scale) * 1000) / 1000;
                        }

                        if (!currentFrame) {
                            currentFrame = frame;
                            return;
                        }
                        
                        if (isFrameEqual(currentFrame, frame)) {
                            currentFrame.DU = (currentFrame.DU || 1) + (frame.DU || 1);
                            duplicatesRemoved++;
                        } else {
                            optimizedFrames.push(currentFrame);
                            currentFrame = frame;
                        }
                    });
                    if (currentFrame) optimizedFrames.push(currentFrame);
                    layer.FR = optimizedFrames;
                });
            }
            if (duplicatesRemoved > 0) log.innerText += `Очищено дубликатов в Animation.json: ${duplicatesRemoved}\n`;
            
            const animFileName = customName ? `${baseName}_Animation.json` : animFile.name;
            zip.file(animFileName, JSON.stringify(animData, null, 0));
            log.innerText += "Разметка JSON добавлена в архив!\n";

        } catch (e) {
            return alert('Ошибка чтения JSON: ' + e.message);
        }
    }

    // --- ОБРАБОТКА DATA-CHARACTER ---
    const charDataFile = document.getElementById('charDataInput').files[0];
    if (charDataFile && currentMode !== 'sprite') {
        log.innerText += `Обработка файла конфигурации персонажа...\n`;
        try {
            const engine = document.getElementById('engineSelect').value;
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

                // Масштабируем оффсеты анимаций (x и y у <anim>)
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

                    // Коррекция позиции на основе средних размеров кадров
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
            }
            else if (engine === 'psych' && charExt === 'json') {
                let data = JSON.parse(charText);
                
                if (data.position) data.position = data.position.map(v => Math.round(v * scale));
                if (data.camera_position) data.camera_position = data.camera_position.map(v => Math.round(v * scale));
                
                // Компенсация размера через scale
                if (data.scale !== undefined) {
                    data.scale = Math.round((data.scale / scale) * 1000) / 1000;
                }
                
                if (data.animations) {
                    data.animations.forEach(anim => {
                        if (anim.offsets) anim.offsets = anim.offsets.map(v => Math.round(v * scale));
                    });
                }
                newCharData = JSON.stringify(data, null, '\t');
            }
            else if (engine === 'vslice' && charExt === 'json') {
                // Парсим V-Slice JSON
                let data = JSON.parse(charText);
                if (data.offsets) data.offsets = data.offsets.map(v => Math.round(v * scale));
                if (data.cameraOffsets) data.cameraOffsets = data.cameraOffsets.map(v => Math.round(v * scale));
                if (data.death && data.death.cameraOffsets) {
                    data.death.cameraOffsets = data.death.cameraOffsets.map(v => Math.round(v * scale));
                }
                
                if (data.animations) {
                    data.animations.forEach(anim => {
                        if (anim.offsets) anim.offsets = anim.offsets.map(v => Math.round(v * scale));
                    });
                }
                newCharData = JSON.stringify(data, null, 2);ы
            } else {
                log.innerText += `⚠️ Внимание: Расширение файла не совпадает с движком. Файл добавлен без изменений.\n`;
                newCharData = charText;
            }

            // Кладем в папку 'character data'
            zip.folder("character data").file(charName, newCharData);
            log.innerText += `✅ Конфигурация персонажа сохранена в character data/\n`;
        } catch (e) {
            log.innerText += `❌ Ошибка обработки файла персонажа: ${e.message}\n`;
        }
    }
    // --- КОНЕЦ ОБРАБОТКИ DATA-CHARACTER ---

    // Сборка
    log.innerText += "Сборка ZIP-архива...\n";
    const zipContent = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zipContent);
    const downloadName = customName ? `${customName}_FunkinSheet.zip` : `${baseName}_Optimized.zip`;
    a.download = downloadName;
    a.click();
    log.innerText += "Готово! Архив скачан.";
}

function isFrameEqual(f1, f2) {
    if (!f1.E || !f1.E[0] || !f1.E[0].SI || !f2.E || !f2.E[0] || !f2.E[0].SI) return false;
    const e1 = f1.E[0].SI;
    const e2 = f2.E[0].SI;
    const sameSymbol = e1.SN === e2.SN && e1.FF === e2.FF;
    const sameTRP = (e1.TRP ? e1.TRP.x : 0) === (e2.TRP ? e2.TRP.x : 0) && (e1.TRP ? e1.TRP.y : 0) === (e2.TRP ? e2.TRP.y : 0);
    return sameSymbol && sameTRP;
}