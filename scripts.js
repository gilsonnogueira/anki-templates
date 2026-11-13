/**
 * ============================================================================
 * ANKI TEMPLATES ENGINE - UNIFIED DYNAMIC RENDERER & CONTROLLER (FRENTE & VERSO)
 * Repositório Oficial: https://github.com/gilsonnogueira/anki-templates
 * GitHub Pages CDN:    https://gilsonnogueira.github.io/anki-templates/scripts.js
 * ============================================================================
 */
(function() {
    var rawFields = document.getElementById('anki-raw-fields');
    if (rawFields && rawFields.getAttribute('data-mounted') === 'true') {
        return;
    }
    if (rawFields) {
        rawFields.setAttribute('data-mounted', 'true');
    }

        function sanitizeMarkdown(html) {
        if (!html || typeof html !== 'string') return '';
        var stash = [];
        function saveToken(match) {
            stash.push(match);
            return '@@TKN' + (stash.length - 1) + '@@';
        }
        
        // 1. Proteger fórmulas matemáticas e tags HTML contra corrupção de Markdown
        html = html.replace(/\\\[[\s\S]*?\\\]/g, saveToken);
        html = html.replace(/\\\([\s\S]*?\\\\)/g, saveToken);
        html = html.replace(/<anki-mathjax[\s\S]*?<\/anki-mathjax>/gi, saveToken);
        html = html.replace(/<[^>]+>/g, saveToken);
        
        // 2. Markdown apenas em texto puro
        html = html.replace(/(\*\*\*|___)(.+?)\1/g, '<b><i>$2</i></b>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
        html = html.replace(/(^|[^\*])\*([^\*\s][^\*]*?[^\*\s]|\S)\*([^\*]|$)/g, '$1<i>$2</i>$3');
        html = html.replace(/`([^`]+?)`/g, '<code class="inline-code">$1</code>');
        html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
        
        // 3. Restaurar tokens intactos
        for (var i = stash.length - 1; i >= 0; i--) {
            html = html.replace('@@TKN' + i + '@@', stash[i]);
        }
        return html;
    }

    function getRawField(id) {
        var el = document.getElementById(id);
        var val = el ? el.innerHTML : '';
        return sanitizeMarkdown(val);
    }

    function triggerMathJaxRender() {
        var attempts = 0;
        function tryRender() {
            attempts++;
            try {
                if (window.MathJax) {
                    if (typeof MathJax.typesetClear === 'function') {
                        try { MathJax.typesetClear(); } catch(e) {}
                    }
                    if (typeof MathJax.typesetPromise === 'function') {
                        MathJax.typesetPromise().catch(function(err){});
                        return;
                    } else if (typeof MathJax.typeset === 'function') {
                        MathJax.typeset();
                        return;
                    } else if (MathJax.Hub && typeof MathJax.Hub.Queue === 'function') {
                        MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                        return;
                    }
                }
            } catch(e) {}
            
            if (attempts < 25) {
                setTimeout(tryRender, attempts < 5 ? 40 : 100);
            }
        }
        tryRender();
    }


    var side = rawFields ? (rawFields.getAttribute('data-side') || 'front') : (document.getElementById('answer') ? 'back' : 'front');
    var appRoot = document.getElementById('anki-app-root');

    // Blindagem de Auto-Cura: se alguma tag <div> não fechada em campos brutos tiver engolido o appRoot para dentro de rawFields (display:none), resgatamos o appRoot para o body
    if (appRoot && rawFields && rawFields.contains(appRoot)) {
        document.body.appendChild(appRoot);
    }

    if (appRoot && rawFields) {
        var disciplina = getRawField('raw-disciplina');
        var assunto = getRawField('raw-assunto');
        var questao = getRawField('raw-questao');
        var resposta = getRawField('raw-resposta');
        var comentario = getRawField('raw-comentario');
        var explicacao = getRawField('raw-explicacao');
        var hasExplicacao = explicacao.replace(/<[^>]*>/g, '').trim().length > 0 || explicacao.indexOf('<img') !== -1 || explicacao.indexOf('<svg') !== -1;
        var isCloze = (questao && (questao.indexOf('class="cloze"') !== -1 || questao.indexOf("class='cloze'") !== -1)) || (rawFields && rawFields.querySelector('.cloze') !== null) || (!resposta || resposta.trim().length === 0);
        function extractInvisibleWatermark(str) {
            if (!str || str.indexOf('\u200D') === -1) return null;
            var parts = str.split('\u200D');
            for (var p = 1; p < parts.length; p += 2) {
                var zw = parts[p];
                if (!zw || zw.length < 8) continue;
                var binary = '';
                for (var i = 0; i < zw.length; i++) {
                    var ch = zw[i];
                    if (ch === '\u200C') binary += '1';
                    else if (ch === '\u200B') binary += '0';
                }
                if (binary.length >= 8 && binary.length % 8 === 0) {
                    var byteList = [];
                    for (var j = 0; j < binary.length; j += 8) {
                        byteList.push(parseInt(binary.substr(j, 8), 2));
                    }
                    try {
                        var decoded = new TextDecoder('utf-8').decode(new Uint8Array(byteList));
                        if (decoded && decoded.indexOf('LIC:') === 0) {
                            return decoded.replace(/^LIC:/, '');
                        }
                    } catch(e) {
                        var chars = '';
                        for (var k = 0; k < byteList.length; k++) {
                            chars += String.fromCharCode(byteList[k]);
                        }
                        if (chars.indexOf('LIC:') === 0) return chars.replace(/^LIC:/, '');
                    }
                }
            }
            return null;
        }

        var drmObj = window.__ANKI_DRM__ || null;
        var drmText = (drmObj && drmObj.text) ? drmObj.text : null;
        if (!drmText) {
            drmText = extractInvisibleWatermark(comentario) || extractInvisibleWatermark(explicacao) || extractInvisibleWatermark(questao);
        }
        var drmHtml = drmText ? ('<div class="anki-drm-footer" title="Licença de Uso Pessoal"><span class="drm-lock">🔒</span> <span>' + drmText + '</span></div>') : '';

        if (side === 'front') {
            appRoot.innerHTML =
                '<div class="card-scene">' +
                    '<div class="main-wrapper' + (isCloze ? ' is-cloze-card' : '') + '">' +
                        '<div class="header-box">' +
                            '<div class="header-top-row">' +
                                '<svg class="header-logo-svg is-frente" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Flashcards">' +
                                    '<defs>' +
                                        '<linearGradient id="fcCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                                            '<stop offset="0%" stop-color="#38bdf8" />' +
                                            '<stop offset="100%" stop-color="#0284c7" />' +
                                        '</linearGradient>' +
                                    '</defs>' +
                                    '<rect class="fc-card fc-card-4" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<rect class="fc-card fc-card-3" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<rect class="fc-card fc-card-2" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<g class="fc-front-fan">' +
                                        '<rect class="fc-card fc-front-rect" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                        '<text class="fc-mark-q" x="14" y="22.2" text-anchor="middle" font-family="\'Inter\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">?</text>' +
                                    '</g>' +
                                '</svg>' +
                                '<div class="header-actions">' +
                                    '<button id="btn-toggle-autoplay" type="button" class="btn-autoplay is-manual" onclick="window.toggleAutoplayPref(event)" title="Alternar Reprodução Automática">' +
                                        '<span class="autoplay-dot"></span>' +
                                        '<span class="autoplay-label">Manual</span>' +
                                    '</button>' +
                                    '<button id="btn-tts-front" type="button" class="btn-tts" onclick="window.toggleFrontTTS(event)" title="Ouvir questão (Atalho: R)">' +
                                        '<span class="tts-icon">' +
                                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                                '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
                                                '<path class="tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
                                                '<path class="tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
                                            '</svg>' +
                                        '</span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="header-tags-row">' +
                                '<span class="tag tag-primary">' + disciplina + '</span>' +
                                '<span class="tag">' + assunto + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div id="front-text" class="question-text">' + questao + '</div>' +
                        drmHtml +
                    '</div>' +
                '</div>';
        triggerMathJaxRender();
        setTimeout(triggerMathJaxRender, 80);
        } else {
            appRoot.innerHTML =
                '<div class="card-scene">' +
                    '<div class="main-wrapper' + (isCloze ? ' is-cloze-card' : '') + '">' +
                        '<div class="header-box">' +
                            '<div class="header-top-row">' +
                                '<svg class="header-logo-svg" id="header-logo-svg" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Flashcards">' +
                                    '<defs>' +
                                        '<linearGradient id="fcCyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                                            '<stop offset="0%" stop-color="#38bdf8" />' +
                                            '<stop offset="100%" stop-color="#0284c7" />' +
                                        '</linearGradient>' +
                                        '<linearGradient id="fcRightGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                                            '<stop offset="0%" stop-color="#34d399" />' +
                                            '<stop offset="100%" stop-color="#059669" />' +
                                        '</linearGradient>' +
                                        '<linearGradient id="fcWrongGrad" x1="0%" y1="0%" x2="100%" y2="100%">' +
                                            '<stop offset="0%" stop-color="#fb7185" />' +
                                            '<stop offset="100%" stop-color="#e11d48" />' +
                                        '</linearGradient>' +
                                    '</defs>' +
                                    '<rect class="fc-card fc-card-4" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<rect class="fc-card fc-card-3" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<rect class="fc-card fc-card-2" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                    '<g class="fc-front-fan">' +
                                        '<rect class="fc-card fc-front-rect" x="3.5" y="11.5" width="21" height="15" rx="3.2" />' +
                                        '<text class="fc-mark-q" x="14" y="22.2" text-anchor="middle" font-family="\'Inter\', -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif" font-size="10.5" font-weight="900" fill="#ffffff">?</text>' +
                                        '<path class="fc-mark-check" d="M10.8 19.2 L13.2 21.5 L17.5 16.5" />' +
                                        '<path class="fc-mark-cross" d="M11.5 16.5 L16.5 21.5 M16.5 16.5 L11.5 21.5" />' +
                                    '</g>' +
                                '</svg>' +
                                '<div class="header-actions">' +
                                    (!isCloze ? '<button id="btn-toggle-front-back" type="button" class="btn-toggle-front is-active" onclick="window.toggleFrontBackPref(event)" title="Alternar exibição da frente no verso (Atalho: F)">' +
                                        '<span class="front-dot"></span>' +
                                        '<span class="front-label">Frente</span>' +
                                    '</button>' : '') +
                                    '<button id="btn-toggle-autoplay-back" type="button" class="btn-autoplay is-manual" onclick="window.toggleAutoplayPref(event)" title="Alternar Reprodução Automática">' +
                                        '<span class="autoplay-dot"></span>' +
                                        '<span class="autoplay-label">Manual</span>' +
                                    '</button>' +
                                    '<button id="btn-tts-comment" type="button" class="btn-tts" onclick="window.toggleCommentTTS(event)" title="Ouvir comentário (Atalho: R)">' +
                                        '<span class="tts-icon">' +
                                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                                '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
                                                '<path class="tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
                                                '<path class="tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
                                            '</svg>' +
                                        '</span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                            '<div class="header-tags-row">' +
                                '<span class="tag tag-primary">' + disciplina + '</span>' +
                                '<span class="tag">' + assunto + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div id="front-back-box" class="front-back-box">' +
                            '<div id="front-text-back" class="question-back">' + questao + '</div>' +
                        '</div>' +
                        (!isCloze && resposta && resposta.trim() ? '<div id="answer" class="answer-text">' + resposta + '</div>' : '') +
                        '<div id="comment-box" class="comment-text">' + comentario + '</div>' +
                        (hasExplicacao ?
                            '<div class="explanation-container">' +
                                '<div class="btn-center">' +
                                    '<button id="btn-explain" type="button" onclick="window.toggleExplanation(event)">Explicar</button>' +
                                    '<button id="btn-tts-explain" type="button" class="btn-tts" style="display:none;" onclick="window.toggleExplainTTS(event)" title="Ouvir explicação">' +
                                        '<span class="tts-icon">' +
                                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                                                '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
                                                '<path class="tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>' +
                                                '<path class="tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
                                            '</svg>' +
                                        '</span>' +
                                    '</button>' +
                                '</div>' +
                                '<div id="explanation-content" style="display: none;">' +
                                    '<hr class="explanation-divider">' +
                                    '<div id="explanation-body" class="explanation-text">' + explicacao + '</div>' +
                                '</div>' +
                            '</div>'
                        : '') +
                        drmHtml +
                    '</div>' +
                '</div>';
        triggerMathJaxRender();
        setTimeout(triggerMathJaxRender, 80);
        }
    }

    if (side === 'front') {

/**
 * ============================================================================
 * MOTOR JAVASCRIPT DA FRENTE (Ciclo de Vida, Áudio Neural/Nativo e Teclado)
 * ============================================================================
 */
(function() {
    var TTS_ICONS = {
        idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path class="tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path class="tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
        loading: '<svg class="tts-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle><path d="M12 3a9 9 0 0 1 9 9"></path></svg>',
        speaking: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.35"></circle><rect class="tts-stop-core" x="8" y="8" width="8" height="8" rx="2.2" fill="currentColor"></rect></svg>'
    };

    var isAndroid = (typeof AnkiDroidJS !== 'undefined') || 
                    (navigator.userAgent && /android/i.test(navigator.userAgent)) ||
                    document.documentElement.classList.contains('android') ||
                    (document.body && document.body.classList.contains('android'));

    function getAnkiDroidApi() {
        if (typeof AnkiDroidJS === 'undefined') return null;
        if (!window.__ANKIDROID_API__) {
            try {
                window.__ANKIDROID_API__ = new AnkiDroidJS({ version: "0.0.3", developer: "anki_card" });
            } catch(e) {}
        }
        return window.__ANKIDROID_API__;
    }

    function setBtnState(btn, state) {
        if (!btn) return;
        var icon = btn.querySelector('.tts-icon');
        btn.classList.remove('speaking', 'loading');
        if (state === 'loading') {
            btn.classList.add('loading');
            if (icon) icon.innerHTML = TTS_ICONS.loading;
            btn.title = 'Carregando áudio...';
        } else if (state === 'speaking') {
            btn.classList.add('speaking');
            if (icon) icon.innerHTML = TTS_ICONS.speaking;
            btn.title = 'Parar áudio (Atalho: R)';
        } else {
            if (icon) icon.innerHTML = TTS_ICONS.idle;
            btn.title = 'Ouvir (Atalho: R)';
        }
    }

    window.stopAllAudio = function() {
        window.__ANKI_TTS_GEN__ = (window.__ANKI_TTS_GEN__ || 0) + 1;
        window.__ANKI_IS_SPEAKING__ = false;
        window.__ANKI_SPEAKING_TARGET__ = null;

        if (window.__ANKI_CHUNK_TIMER__) {
            clearTimeout(window.__ANKI_CHUNK_TIMER__);
            window.__ANKI_CHUNK_TIMER__ = null;
        }
        if (window.__ANKI_AUTOPLAY_TIMER__) {
            clearTimeout(window.__ANKI_AUTOPLAY_TIMER__);
            window.__ANKI_AUTOPLAY_TIMER__ = null;
        }
        if (window.__ANKI_NATIVE_TIMER__) {
            clearTimeout(window.__ANKI_NATIVE_TIMER__);
            window.__ANKI_NATIVE_TIMER__ = null;
        }
        if (window.__ANKI_EXPLAIN_TIMER__) {
            clearTimeout(window.__ANKI_EXPLAIN_TIMER__);
            window.__ANKI_EXPLAIN_TIMER__ = null;
        }
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }

        if (window.__ANKI_ACTIVE_XHR__) {
            try { window.__ANKI_ACTIVE_XHR__.abort(); } catch(e) {}
            window.__ANKI_ACTIVE_XHR__ = null;
        }

        if (window.__ANKI_GLOBAL_STREAM__) {
            try {
                window.__ANKI_GLOBAL_STREAM__.oncanplay = null;
                window.__ANKI_GLOBAL_STREAM__.onended = null;
                window.__ANKI_GLOBAL_STREAM__.onpause = null;
                window.__ANKI_GLOBAL_STREAM__.onerror = null;
                window.__ANKI_GLOBAL_STREAM__.pause();
                window.__ANKI_GLOBAL_STREAM__.currentTime = 0;
                window.__ANKI_GLOBAL_STREAM__.removeAttribute('src');
                window.__ANKI_GLOBAL_STREAM__.load();
            } catch(e) {}
            window.__ANKI_GLOBAL_STREAM__ = null;
        }

        if (window.__ANKI_BLOB_URL__) {
            try { URL.revokeObjectURL(window.__ANKI_BLOB_URL__); } catch(e) {}
            window.__ANKI_BLOB_URL__ = null;
        }

        window.__ANKI_ACTIVE_UTTERANCES__ = [];

        if ('speechSynthesis' in window) {
            try {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
                window.speechSynthesis.cancel();
            } catch(e) {}
        }

        var droidApi = getAnkiDroidApi();
        if (droidApi) {
            try { droidApi.ankiTtsStop(); } catch(e) {}
        }

        var btns = document.querySelectorAll('.btn-tts');
        for (var b = 0; b < btns.length; b++) {
            setBtnState(btns[b], 'idle');
        }
    };

    window.stopAllAudio();

    function extrairTextoElemento(el) {
        if (!el) return '';
        var clone = el.cloneNode(true);
        var ignorar = clone.querySelectorAll('.mermaid, .mermaid-pending, pre.mermaid, svg, .mermaid-box, script, style, .tts-ignore, [data-tts="ignore"], mjx-container, mjx-assistive-mml, .MathJax, .MathJax_Preview, math, [aria-hidden="true"]');
        for (var i = 0; i < ignorar.length; i++) {
            if (ignorar[i].parentNode) ignorar[i].parentNode.removeChild(ignorar[i]);
        }
        var html = clone.innerHTML || '';
        html = html.replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, ' ');
        clone.innerHTML = html;
        return (clone.textContent || clone.innerText || '').replace(/\s+/g, ' ').trim();
    }

        // Divide textos longos em chunks seguros (< 140 caracteres) para evitar o bug de timeout do Chromium/Android
    function dividirEmFrases(texto) {
        if (!texto) return [];
        var partes = texto.match(/[^.!?;\r\n]+[.!?;\r\n]+|[^.!?;\r\n]+$/g) || [texto];
        var subPartes = [];

        for (var i = 0; i < partes.length; i++) {
            var sent = partes[i].trim();
            if (!sent) continue;
            if (sent.length > 150) {
                var pedacos = sent.match(/[^,:]+[,:]+|[^,:]+$/g) || [sent];
                for (var j = 0; j < pedacos.length; j++) {
                    var pj = pedacos[j].trim();
                    if (pj) subPartes.push(pj);
                }
            } else {
                subPartes.push(sent);
            }
        }

        var chunks = [];
        var atual = '';
        for (var k = 0; k < subPartes.length; k++) {
            var p = subPartes[k];
            if ((atual + ' ' + p).length < 140) {
                atual = atual ? (atual + ' ' + p) : p;
            } else {
                if (atual) chunks.push(atual);
                atual = p;
            }
        }
        if (atual) chunks.push(atual);
        return chunks.length > 0 ? chunks : [texto];
    }

    function falarComSpeechSynthesis(textoLimpo, triggerBtn, myGen) {
        if (!('speechSynthesis' in window)) {
            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
            return;
        }

        try {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
            window.speechSynthesis.cancel();
        } catch(e) {}

        var chunks = dividirEmFrases(textoLimpo);
        if (!chunks || chunks.length === 0) {
            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
            return;
        }

        var voice = null;
        if (window.speechSynthesis.getVoices) {
            var voices = window.speechSynthesis.getVoices();
            if (voices && voices.length) {
                for (var v = 0; v < voices.length; v++) {
                    if (voices[v].lang && voices[v].lang.toLowerCase().indexOf('pt') === 0) {
                        voice = voices[v];
                        break;
                    }
                }
            }
        }

        window.__ANKI_ACTIVE_UTTERANCES__ = [];
        var chunkIndex = 0;

        function finalizarFala() {
            if (window.__ANKI_CHUNK_TIMER__) {
                clearTimeout(window.__ANKI_CHUNK_TIMER__);
                window.__ANKI_CHUNK_TIMER__ = null;
            }
            if (window.__ANKI_WATCHDOG_TIMER__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
            }
            window.__ANKI_ACTIVE_UTTERANCES__ = [];
            if (myGen === window.__ANKI_TTS_GEN__) {
                window.__ANKI_IS_SPEAKING__ = false;
                window.__ANKI_SPEAKING_TARGET__ = null;
                var btns = document.querySelectorAll('.btn-tts');
                for (var b = 0; b < btns.length; b++) {
                    setBtnState(btns[b], 'idle');
                }
            }
        }

        function falarProximoChunk() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;

            if (chunkIndex >= chunks.length) {
                finalizarFala();
                return;
            }

            var chunkTexto = chunks[chunkIndex++];
            if (!chunkTexto || !chunkTexto.trim()) {
                falarProximoChunk();
                return;
            }

            var u = new SpeechSynthesisUtterance(chunkTexto);
            u.lang = 'pt-BR';
            u.rate = isAndroid ? 1.0 : 1.05;
            if (voice) u.voice = voice;

            window.__ANKI_ACTIVE_UTTERANCES__.push(u);

            var chunkFinished = false;
            function aoTerminarChunk() {
                if (chunkFinished) return;
                chunkFinished = true;

                if (window.__ANKI_CHUNK_TIMER__) {
                    clearTimeout(window.__ANKI_CHUNK_TIMER__);
                    window.__ANKI_CHUNK_TIMER__ = null;
                }

                var idx = window.__ANKI_ACTIVE_UTTERANCES__.indexOf(u);
                if (idx > -1) {
                    window.__ANKI_ACTIVE_UTTERANCES__.splice(idx, 1);
                }

                if (myGen === window.__ANKI_TTS_GEN__) {
                    setTimeout(falarProximoChunk, 30);
                }
            }

            u.onend = aoTerminarChunk;
            u.onerror = function(ev) {
                if (myGen !== window.__ANKI_TTS_GEN__) return;
                if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
                aoTerminarChunk();
            };

            // Watchdog por chunk: protege contra o bug clássico do Chromium no Android
            // onde u.onend pode ser silenciado ou não disparar
            var duracaoEstimadaMs = Math.max(1400, Math.round((chunkTexto.length / 11) * 1000) + 1600);
            window.__ANKI_CHUNK_TIMER__ = setTimeout(function() {
                if (myGen !== window.__ANKI_TTS_GEN__) return;
                aoTerminarChunk();
            }, duracaoEstimadaMs);

            try {
                window.speechSynthesis.speak(u);
            } catch(e) {
                aoTerminarChunk();
            }
        }

        falarProximoChunk();

        // Anti-pause preventivo leve para evitar congelamento de WebView móvel
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }
        window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
            if (myGen !== window.__ANKI_TTS_GEN__ || !window.__ANKI_IS_SPEAKING__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                return;
            }
            if ('speechSynthesis' in window && window.speechSynthesis.paused) {
                try { window.speechSynthesis.resume(); } catch(e) {}
            }
        }, 1500);
    }

    function falarAnkiDroidJS(textoLimpo, triggerBtn, myGen) {
        var droidApi = getAnkiDroidApi();
        if (droidApi && typeof droidApi.ankiTtsSpeak === 'function') {
            try {
                droidApi.ankiTtsSetLanguage("pt-BR");
                droidApi.ankiTtsSpeak(textoLimpo, 0);
                iniciarMonitoramentoDroid(textoLimpo, triggerBtn, myGen);
                return true;
            } catch(e) {}
        }
        return false;
    }

    function iniciarMonitoramentoDroid(textoLimpo, triggerBtn, myGen) {
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }

        var droidApi = getAnkiDroidApi();
        if (!droidApi || typeof droidApi.ankiTtsIsSpeaking !== 'function') return;

        var sawSpeaking = false;
        var notSpeakingCount = 0;
        var startTime = Date.now();
        var maxDurationMs = Math.max(2500, Math.round((textoLimpo.length / 10) * 1000) + 2000);

        window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
            if (myGen !== window.__ANKI_TTS_GEN__ || !window.__ANKI_IS_SPEAKING__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                return;
            }

            var elapsed = Date.now() - startTime;
            if (elapsed > maxDurationMs) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                if (myGen === window.__ANKI_TTS_GEN__) {
                    window.__ANKI_IS_SPEAKING__ = false;
                    setBtnState(triggerBtn, 'idle');
                }
                return;
            }

            try {
                var p = droidApi.ankiTtsIsSpeaking();
                if (p && typeof p.then === 'function') {
                    p.then(function(speaking) {
                        if (myGen !== window.__ANKI_TTS_GEN__) return;
                        if (speaking === true) {
                            sawSpeaking = true;
                            notSpeakingCount = 0;
                        } else if (speaking === false) {
                            if (sawSpeaking || elapsed > 1000) {
                                notSpeakingCount++;
                                if (notSpeakingCount >= 2) {
                                    clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                                    window.__ANKI_WATCHDOG_TIMER__ = null;
                                    window.__ANKI_IS_SPEAKING__ = false;
                                    setBtnState(triggerBtn, 'idle');
                                }
                            }
                        }
                    }).catch(function() {});
                }
            } catch(e) {}
        }, 350);
    }

    function falarNativo(textoLimpo, triggerBtn, targetName) {
        window.stopAllAudio();
        var myGen = window.__ANKI_TTS_GEN__;
        window.__ANKI_IS_SPEAKING__ = true;
        window.__ANKI_SPEAKING_TARGET__ = targetName || 'front';
        setBtnState(triggerBtn, 'speaking');

        window.__ANKI_NATIVE_TIMER__ = setTimeout(function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;

            // 1. Tenta SpeechSynthesis padrão com divisão em frases e anti-sleep
            if ('speechSynthesis' in window) {
                try {
                    falarComSpeechSynthesis(textoLimpo, triggerBtn, myGen);
                    return;
                } catch(e) {}
            }

            // 2. Fallback para API AnkiDroidJS se SpeechSynthesis não estiver disponível
            if (falarAnkiDroidJS(textoLimpo, triggerBtn, myGen)) {
                return;
            }

            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
        }, 50);
    }

    function falarElevenReader(textoLimpo, triggerBtn, side, targetName) {
        window.stopAllAudio();
        var myGen = window.__ANKI_TTS_GEN__;
        window.__ANKI_IS_SPEAKING__ = true;
        window.__ANKI_SPEAKING_TARGET__ = targetName || 'front';
        setBtnState(triggerBtn, 'loading');

        // Se for Android, não tenta ElevenReader na porta 8766 (PC); vai direto para o TTS nativo
        if (isAndroid) {
            falarNativo(textoLimpo, triggerBtn, targetName);
            return;
        }

        var port = window.__ELEVEN_PORT__ || 8766;
        var streamUrl = "http://127.0.0.1:" + port + "/speak?side=" + encodeURIComponent(side || 'front') + "&text=" + encodeURIComponent(textoLimpo);

        function tocarAudioMonitorado(srcUrl) {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            var audio = new Audio(srcUrl);
            window.__ANKI_GLOBAL_STREAM__ = audio;

            var lastTime = -1;
            var stallTicks = 0;

            audio.oncanplay = function() {
                if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) return;
                setBtnState(triggerBtn, 'speaking');
            };

            audio.onended = function() {
                if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                    window.stopAllAudio();
                }
            };

            audio.onerror = function() {
                if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                    window.stopAllAudio();
                    falarNativo(textoLimpo, triggerBtn, targetName);
                }
            };

            if (window.__ANKI_WATCHDOG_TIMER__) clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
                if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) {
                    clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                    window.__ANKI_WATCHDOG_TIMER__ = null;
                    return;
                }
                if (audio.ended) {
                    window.stopAllAudio();
                    return;
                }
                if (audio.duration && isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.06) {
                    window.stopAllAudio();
                    return;
                }
                if (audio.currentTime > 0) {
                    if (audio.paused) {
                        window.stopAllAudio();
                        return;
                    }
                    if (Math.abs(audio.currentTime - lastTime) < 0.001) {
                        stallTicks++;
                        if (stallTicks >= 4) {
                            window.stopAllAudio();
                            return;
                        }
                    } else {
                        stallTicks = 0;
                        lastTime = audio.currentTime;
                    }
                }
            }, 180);

            var playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(function() {
                    if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                        setBtnState(triggerBtn, 'speaking');
                    }
                }).catch(function(err) {
                    if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) return;
                    if (err && err.name === 'NotAllowedError') {
                        console.warn('[ElevenReader TTS] Autoplay bloqueado pelo WebEngine/navegador.');
                        setBtnState(triggerBtn, 'idle');
                        window.__ANKI_IS_SPEAKING__ = false;
                        return;
                    }
                });
            }
        }

        var xhr = new XMLHttpRequest();
        window.__ANKI_ACTIVE_XHR__ = xhr;
        xhr.open('GET', streamUrl, true);
        xhr.responseType = 'blob';
        xhr.onload = function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            window.__ANKI_ACTIVE_XHR__ = null;
            if (xhr.status === 200 && xhr.response && xhr.response.size > 128) {
                var blobUrl = URL.createObjectURL(xhr.response);
                window.__ANKI_BLOB_URL__ = blobUrl;
                tocarAudioMonitorado(blobUrl);
            } else {
                window.stopAllAudio();
                falarNativo(textoLimpo, triggerBtn, targetName);
            }
        };
        xhr.onerror = function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            window.__ANKI_ACTIVE_XHR__ = null;
            window.stopAllAudio();
            falarNativo(textoLimpo, triggerBtn, targetName);
        };
        try {
            xhr.send();
        } catch(e) {
            window.__ANKI_ACTIVE_XHR__ = null;
            tocarAudioMonitorado(streamUrl);
        }
    }

    function checarAddonPC(callback) {
        if (window.__HAS_ELEVEN_ADDON__ === true) {
            callback(true);
            return;
        }
        var cached = sessionStorage.getItem('has_eleven_addon');
        if (cached === 'true') { callback(true); return; }
        if (cached === 'false') { callback(false); return; }

        var port = window.__ELEVEN_PORT__ || 8766;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://127.0.0.1:' + port + '/status', true);
        xhr.timeout = 1200;
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (typeof window.__anki_autoplay === 'undefined' && typeof data.autoplay !== 'undefined') {
                        window.__anki_autoplay = data.autoplay;
                    }
                } catch(e) {}
                window.__HAS_ELEVEN_ADDON__ = true;
                sessionStorage.setItem('has_eleven_addon', 'true');
                callback(true);
            } else {
                sessionStorage.setItem('has_eleven_addon', 'false');
                callback(false);
            }
        };
        xhr.onerror = function() { callback(false); };
        xhr.ontimeout = function() { callback(false); };
        try { xhr.send(); } catch(e) { callback(false); }
    }

    function executarFala(textoLimpo, triggerBtn, side, targetName) {
        if (!textoLimpo) return;

        if (isAndroid) {
            falarNativo(textoLimpo, triggerBtn, targetName);
            return;
        }

        var myGen = window.__ANKI_TTS_GEN__;
        checarAddonPC(function(temAddon) {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            if (temAddon) {
                falarElevenReader(textoLimpo, triggerBtn, side || 'front', targetName);
            } else {
                falarNativo(textoLimpo, triggerBtn, targetName);
            }
        });
    }

    window.startFrontTTS = function() {
        var el = document.getElementById('front-text');
        var btn = document.getElementById('btn-tts-front');
        var txt = extrairTextoElemento(el);
        if (txt) executarFala(txt, btn, 'front', 'front');
    };

    window.__LAST_TTS_TIME__ = 0;
    window.__TTS_STARTED_AT__ = 0;
    window.safeToggleTTS = function(type) {
        var now = Date.now();
        if (now - window.__LAST_TTS_TIME__ < 600) return;
        window.__LAST_TTS_TIME__ = now;

        if (window.__ANKI_IS_SPEAKING__) {
            if (now - (window.__TTS_STARTED_AT__ || 0) < 800) {
                return;
            }
            window.stopAllAudio();
        } else {
            window.__TTS_STARTED_AT__ = now;
            window.startFrontTTS();
        }
    };

    window.toggleFrontTTS = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        window.safeToggleTTS('front');
    };

    function handleKeyEvents(e) {
        var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;
        
        var ankiAnswerCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Space', 'Enter', 'NumpadEnter'];
        var ankiAnswerKeys = ['1', '2', '3', '4', ' ', 'Enter'];
        if (ankiAnswerCodes.includes(e.code) || ankiAnswerKeys.includes(e.key)) {
            window.stopAllAudio();
            return;
        }

        var key = (e.key || '').toLowerCase();
        if (key === 'r' || key === 'a') {
            e.preventDefault();
            e.stopPropagation();
            if (!window.__HAS_ELEVEN_ADDON__) {
                window.safeToggleTTS('front');
            }
        }
    }

    if (window.__ANKI_KEYDOWN_HANDLER__) {
        window.removeEventListener('keydown', window.__ANKI_KEYDOWN_HANDLER__, true);
    }
    window.__ANKI_KEYDOWN_HANDLER__ = handleKeyEvents;
    window.addEventListener('keydown', window.__ANKI_KEYDOWN_HANDLER__, true);

    if (window.__ANKI_UNLOAD_HANDLER__) {
        window.removeEventListener('beforeunload', window.__ANKI_UNLOAD_HANDLER__);
        window.removeEventListener('pagehide', window.__ANKI_UNLOAD_HANDLER__);
    }
    window.__ANKI_UNLOAD_HANDLER__ = function() { window.stopAllAudio(); };
    window.addEventListener('beforeunload', window.__ANKI_UNLOAD_HANDLER__);
    window.addEventListener('pagehide', window.__ANKI_UNLOAD_HANDLER__);

    // Bloqueia reprodução em segundo plano no Android (para o áudio ao sair do app ou apagar a tela)
    if (window.__ANKI_VISIBILITY_HANDLER__) {
        document.removeEventListener('visibilitychange', window.__ANKI_VISIBILITY_HANDLER__);
        window.removeEventListener('blur', window.__ANKI_VISIBILITY_HANDLER__);
    }
    window.__ANKI_VISIBILITY_HANDLER__ = function() {
        if (document.hidden || document.visibilityState === 'hidden') {
            window.stopAllAudio();
        }
    };
    document.addEventListener('visibilitychange', window.__ANKI_VISIBILITY_HANDLER__);
    window.addEventListener('blur', function() {
        if (isAndroid) {
            window.stopAllAudio();
        }
    });

    // Controle Global e Persistente de Reprodução Automática (Auto / Manual)
    function obterAutoplayPref() {
        try {
            var saved = localStorage.getItem('anki_user_autoplay');
            if (saved === 'true') return true;
            if (saved === 'false') return false;
        } catch (e) {}
        if (typeof window.__anki_autoplay !== 'undefined') {
            return Boolean(window.__anki_autoplay);
        }
        // No Android, se não houver escolha salva, inicia em Manual (Silencioso)
        return false;
    }

    function atualizarBotaoAutoplay(ativo) {
        var btns = document.querySelectorAll('.btn-autoplay');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var lbl = b.querySelector('.autoplay-label');
            if (ativo) {
                b.classList.add('is-active');
                b.classList.remove('is-manual');
                if (lbl) lbl.textContent = 'Auto';
                b.setAttribute('title', 'Reprodução Automática: ATIVADA (Toque para mudar para Manual)');
            } else {
                b.classList.remove('is-active');
                b.classList.add('is-manual');
                if (lbl) lbl.textContent = 'Manual';
                b.setAttribute('title', 'Reprodução Automática: MANUAL/SILENCIOSO (Toque para ativar Auto)');
            }
        }
    }

    window.toggleAutoplayPref = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        var novo = !obterAutoplayPref();
        try {
            localStorage.setItem('anki_user_autoplay', novo ? 'true' : 'false');
        } catch (e) {}
        window.__anki_autoplay = novo;
        atualizarBotaoAutoplay(novo);
        if (novo && !window.__ANKI_IS_SPEAKING__) {
            if (typeof window.startFrontTTS === 'function') {
                window.startFrontTTS();
            } else if (typeof window.startCommentTTS === 'function') {
                window.startCommentTTS();
            }
        }
    };

    function verificarAutoplayPermitido(callback) {
        try {
            var saved = localStorage.getItem('anki_user_autoplay');
            if (saved === 'true' || saved === 'false') {
                var val = (saved === 'true');
                atualizarBotaoAutoplay(val);
                callback(val);
                return;
            }
        } catch (e) {}

        if (typeof window.__anki_autoplay !== 'undefined') {
            var ap = Boolean(window.__anki_autoplay);
            atualizarBotaoAutoplay(ap);
            callback(ap);
            return;
        }

        if (isAndroid) {
            atualizarBotaoAutoplay(false);
            callback(false);
            return;
        }

        checarAddonPC(function() {
            var ap = (typeof window.__anki_autoplay !== 'undefined') ? Boolean(window.__anki_autoplay) : true;
            atualizarBotaoAutoplay(ap);
            callback(ap);
        });
    }

    atualizarBotaoAutoplay(obterAutoplayPref());

    var initGen = window.__ANKI_TTS_GEN__;

    window.__ANKI_AUTOPLAY_TIMER__ = setTimeout(function() {
        if (initGen !== window.__ANKI_TTS_GEN__) return;
        verificarAutoplayPermitido(function(permitido) {
            if (initGen !== window.__ANKI_TTS_GEN__) return;
            if (permitido && !window.__ANKI_IS_SPEAKING__) {
                window.startFrontTTS();
            }
        });
    }, 220);
})();

    } else {

/**
 * ============================================================================
 * MOTOR JAVASCRIPT DO VERSO (Cambalhota 3D, Botão Explicar, Mermaid e TTS)
 * ============================================================================
 */
(function() {
    // INICIALIZAÇÃO INSTANTÂNEA DO GABARITO E DA LOGO (0ms)
    try {
        var ansEl = document.getElementById('answer');
        if (ansEl) {
            var aTxt = (ansEl.textContent || ansEl.innerText || '').trim().toUpperCase();
            var lgs = document.querySelectorAll('.header-logo-svg');
            for (var i = 0; i < lgs.length; i++) {
                lgs[i].classList.remove('is-certo', 'is-errado');
                if (aTxt === 'CERTO') lgs[i].classList.add('is-certo');
                else if (aTxt === 'ERRADO') lgs[i].classList.add('is-errado');
            }
            ansEl.classList.remove('right', 'wrong');
            if (aTxt === 'CERTO') ansEl.classList.add('right');
            else if (aTxt === 'ERRADO') ansEl.classList.add('wrong');
        }
    } catch (e) {}

    var TTS_ICONS = {
        idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path class="tts-wave-1" d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path class="tts-wave-2" d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>',
        loading: '<svg class="tts-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity="0.25"></circle><path d="M12 3a9 9 0 0 1 9 9"></path></svg>',
        speaking: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke-currentColor" stroke-width="1.5" stroke-opacity="0.35"></circle><rect class="tts-stop-core" x="8" y="8" width="8" height="8" rx="2.2" fill="currentColor"></rect></svg>'
    };

    var isAndroid = (typeof AnkiDroidJS !== 'undefined') || 
                    (navigator.userAgent && /android/i.test(navigator.userAgent)) ||
                    document.documentElement.classList.contains('android') ||
                    (document.body && document.body.classList.contains('android'));

    function getAnkiDroidApi() {
        if (typeof AnkiDroidJS === 'undefined') return null;
        if (!window.__ANKIDROID_API__) {
            try {
                window.__ANKIDROID_API__ = new AnkiDroidJS({ version: "0.0.3", developer: "anki_card" });
            } catch(e) {}
        }
        return window.__ANKIDROID_API__;
    }

    function setBtnState(btn, state) {
        if (!btn) return;
        var icon = btn.querySelector('.tts-icon');
        btn.classList.remove('speaking', 'loading');
        if (state === 'loading') {
            btn.classList.add('loading');
            if (icon) icon.innerHTML = TTS_ICONS.loading;
            btn.title = 'Carregando áudio...';
        } else if (state === 'speaking') {
            btn.classList.add('speaking');
            if (icon) icon.innerHTML = TTS_ICONS.speaking;
            btn.title = 'Parar áudio (Atalho: R)';
        } else {
            if (icon) icon.innerHTML = TTS_ICONS.idle;
            btn.title = 'Ouvir (Atalho: R)';
        }
    }

    window.stopAllAudio = function() {
        window.__ANKI_TTS_GEN__ = (window.__ANKI_TTS_GEN__ || 0) + 1;
        window.__ANKI_IS_SPEAKING__ = false;
        window.__ANKI_SPEAKING_TARGET__ = null;

        if (window.__ANKI_CHUNK_TIMER__) {
            clearTimeout(window.__ANKI_CHUNK_TIMER__);
            window.__ANKI_CHUNK_TIMER__ = null;
        }
        if (window.__ANKI_AUTOPLAY_TIMER__) {
            clearTimeout(window.__ANKI_AUTOPLAY_TIMER__);
            window.__ANKI_AUTOPLAY_TIMER__ = null;
        }
        if (window.__ANKI_NATIVE_TIMER__) {
            clearTimeout(window.__ANKI_NATIVE_TIMER__);
            window.__ANKI_NATIVE_TIMER__ = null;
        }
        if (window.__ANKI_EXPLAIN_TIMER__) {
            clearTimeout(window.__ANKI_EXPLAIN_TIMER__);
            window.__ANKI_EXPLAIN_TIMER__ = null;
        }
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }

        if (window.__ANKI_ACTIVE_XHR__) {
            try { window.__ANKI_ACTIVE_XHR__.abort(); } catch(e) {}
            window.__ANKI_ACTIVE_XHR__ = null;
        }

        if (window.__ANKI_GLOBAL_STREAM__) {
            try {
                window.__ANKI_GLOBAL_STREAM__.oncanplay = null;
                window.__ANKI_GLOBAL_STREAM__.onended = null;
                window.__ANKI_GLOBAL_STREAM__.onpause = null;
                window.__ANKI_GLOBAL_STREAM__.onerror = null;
                window.__ANKI_GLOBAL_STREAM__.pause();
                window.__ANKI_GLOBAL_STREAM__.currentTime = 0;
                window.__ANKI_GLOBAL_STREAM__.removeAttribute('src');
                window.__ANKI_GLOBAL_STREAM__.load();
            } catch(e) {}
            window.__ANKI_GLOBAL_STREAM__ = null;
        }

        if (window.__ANKI_BLOB_URL__) {
            try { URL.revokeObjectURL(window.__ANKI_BLOB_URL__); } catch(e) {}
            window.__ANKI_BLOB_URL__ = null;
        }

        window.__ANKI_ACTIVE_UTTERANCES__ = [];

        if ('speechSynthesis' in window) {
            try {
                if (window.speechSynthesis.paused) {
                    window.speechSynthesis.resume();
                }
                window.speechSynthesis.cancel();
            } catch(e) {}
        }

        var droidApi = getAnkiDroidApi();
        if (droidApi) {
            try { droidApi.ankiTtsStop(); } catch(e) {}
        }

        var btns = document.querySelectorAll('.btn-tts');
        for (var b = 0; b < btns.length; b++) {
            setBtnState(btns[b], 'idle');
        }
    };

    window.stopAllAudio();

    // FEEDBACK VISUAL DO GABARITO (Classes 'right' ou 'wrong' no Texto e 'is-certo'/'is-errado' na Logo)
    var answer = document.getElementById('answer');
    if (answer) {
        var answerText = answer.textContent.trim().toUpperCase();
        answer.classList.remove('right', 'wrong');
        var logos = document.querySelectorAll('.header-logo-svg');
        for (var lg = 0; lg < logos.length; lg++) {
            logos[lg].classList.remove('is-certo', 'is-errado');
            if (isCloze || !answerText) {
                logos[lg].classList.remove('is-errado');
                logos[lg].classList.add('is-certo');
            } else if (answerText === 'CERTO') {
                logos[lg].classList.add('is-certo');
            } else if (answerText === 'ERRADO') {
                logos[lg].classList.add('is-errado');
            }
        }
        if (answerText === 'CERTO') {
            answer.classList.add('right');
        } else if (answerText === 'ERRADO') {
            answer.classList.add('wrong');
        }
    }

    function extrairTextoElemento(el) {
        if (!el) return '';
        var clone = el.cloneNode(true);
        var ignorar = clone.querySelectorAll('.mermaid, .mermaid-pending, pre.mermaid, svg, .mermaid-box, script, style, .tts-ignore, [data-tts="ignore"], mjx-container, mjx-assistive-mml, .MathJax, .MathJax_Preview, math, [aria-hidden="true"]');
        for (var i = 0; i < ignorar.length; i++) {
            if (ignorar[i].parentNode) ignorar[i].parentNode.removeChild(ignorar[i]);
        }
        var html = clone.innerHTML || '';
        html = html.replace(/<\s*(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, ' ');
        clone.innerHTML = html;
        return (clone.textContent || clone.innerText || '').replace(/\s+/g, ' ').trim();
    }

        // Divide textos longos em chunks seguros (< 140 caracteres) para evitar o bug de timeout do Chromium/Android
    function dividirEmFrases(texto) {
        if (!texto) return [];
        var partes = texto.match(/[^.!?;\r\n]+[.!?;\r\n]+|[^.!?;\r\n]+$/g) || [texto];
        var subPartes = [];

        for (var i = 0; i < partes.length; i++) {
            var sent = partes[i].trim();
            if (!sent) continue;
            if (sent.length > 150) {
                var pedacos = sent.match(/[^,:]+[,:]+|[^,:]+$/g) || [sent];
                for (var j = 0; j < pedacos.length; j++) {
                    var pj = pedacos[j].trim();
                    if (pj) subPartes.push(pj);
                }
            } else {
                subPartes.push(sent);
            }
        }

        var chunks = [];
        var atual = '';
        for (var k = 0; k < subPartes.length; k++) {
            var p = subPartes[k];
            if ((atual + ' ' + p).length < 140) {
                atual = atual ? (atual + ' ' + p) : p;
            } else {
                if (atual) chunks.push(atual);
                atual = p;
            }
        }
        if (atual) chunks.push(atual);
        return chunks.length > 0 ? chunks : [texto];
    }

    function falarComSpeechSynthesis(textoLimpo, triggerBtn, myGen) {
        if (!('speechSynthesis' in window)) {
            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
            return;
        }

        try {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
            window.speechSynthesis.cancel();
        } catch(e) {}

        var chunks = dividirEmFrases(textoLimpo);
        if (!chunks || chunks.length === 0) {
            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
            return;
        }

        var voice = null;
        if (window.speechSynthesis.getVoices) {
            var voices = window.speechSynthesis.getVoices();
            if (voices && voices.length) {
                for (var v = 0; v < voices.length; v++) {
                    if (voices[v].lang && voices[v].lang.toLowerCase().indexOf('pt') === 0) {
                        voice = voices[v];
                        break;
                    }
                }
            }
        }

        window.__ANKI_ACTIVE_UTTERANCES__ = [];
        var chunkIndex = 0;

        function finalizarFala() {
            if (window.__ANKI_CHUNK_TIMER__) {
                clearTimeout(window.__ANKI_CHUNK_TIMER__);
                window.__ANKI_CHUNK_TIMER__ = null;
            }
            if (window.__ANKI_WATCHDOG_TIMER__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
            }
            window.__ANKI_ACTIVE_UTTERANCES__ = [];
            if (myGen === window.__ANKI_TTS_GEN__) {
                window.__ANKI_IS_SPEAKING__ = false;
                window.__ANKI_SPEAKING_TARGET__ = null;
                var btns = document.querySelectorAll('.btn-tts');
                for (var b = 0; b < btns.length; b++) {
                    setBtnState(btns[b], 'idle');
                }
            }
        }

        function falarProximoChunk() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;

            if (chunkIndex >= chunks.length) {
                finalizarFala();
                return;
            }

            var chunkTexto = chunks[chunkIndex++];
            if (!chunkTexto || !chunkTexto.trim()) {
                falarProximoChunk();
                return;
            }

            var u = new SpeechSynthesisUtterance(chunkTexto);
            u.lang = 'pt-BR';
            u.rate = isAndroid ? 1.0 : 1.05;
            if (voice) u.voice = voice;

            window.__ANKI_ACTIVE_UTTERANCES__.push(u);

            var chunkFinished = false;
            function aoTerminarChunk() {
                if (chunkFinished) return;
                chunkFinished = true;

                if (window.__ANKI_CHUNK_TIMER__) {
                    clearTimeout(window.__ANKI_CHUNK_TIMER__);
                    window.__ANKI_CHUNK_TIMER__ = null;
                }

                var idx = window.__ANKI_ACTIVE_UTTERANCES__.indexOf(u);
                if (idx > -1) {
                    window.__ANKI_ACTIVE_UTTERANCES__.splice(idx, 1);
                }

                if (myGen === window.__ANKI_TTS_GEN__) {
                    setTimeout(falarProximoChunk, 30);
                }
            }

            u.onend = aoTerminarChunk;
            u.onerror = function(ev) {
                if (myGen !== window.__ANKI_TTS_GEN__) return;
                if (ev && (ev.error === 'canceled' || ev.error === 'interrupted')) return;
                aoTerminarChunk();
            };

            // Watchdog por chunk: protege contra o bug clássico do Chromium no Android
            // onde u.onend pode ser silenciado ou não disparar
            var duracaoEstimadaMs = Math.max(1400, Math.round((chunkTexto.length / 11) * 1000) + 1600);
            window.__ANKI_CHUNK_TIMER__ = setTimeout(function() {
                if (myGen !== window.__ANKI_TTS_GEN__) return;
                aoTerminarChunk();
            }, duracaoEstimadaMs);

            try {
                window.speechSynthesis.speak(u);
            } catch(e) {
                aoTerminarChunk();
            }
        }

        falarProximoChunk();

        // Anti-pause preventivo leve para evitar congelamento de WebView móvel
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }
        window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
            if (myGen !== window.__ANKI_TTS_GEN__ || !window.__ANKI_IS_SPEAKING__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                return;
            }
            if ('speechSynthesis' in window && window.speechSynthesis.paused) {
                try { window.speechSynthesis.resume(); } catch(e) {}
            }
        }, 1500);
    }

    function falarAnkiDroidJS(textoLimpo, triggerBtn, myGen) {
        var droidApi = getAnkiDroidApi();
        if (droidApi && typeof droidApi.ankiTtsSpeak === 'function') {
            try {
                droidApi.ankiTtsSetLanguage("pt-BR");
                droidApi.ankiTtsSpeak(textoLimpo, 0);
                iniciarMonitoramentoDroid(textoLimpo, triggerBtn, myGen);
                return true;
            } catch(e) {}
        }
        return false;
    }

    function iniciarMonitoramentoDroid(textoLimpo, triggerBtn, myGen) {
        if (window.__ANKI_WATCHDOG_TIMER__) {
            clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = null;
        }

        var droidApi = getAnkiDroidApi();
        if (!droidApi || typeof droidApi.ankiTtsIsSpeaking !== 'function') return;

        var sawSpeaking = false;
        var notSpeakingCount = 0;
        var startTime = Date.now();
        var maxDurationMs = Math.max(2500, Math.round((textoLimpo.length / 10) * 1000) + 2000);

        window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
            if (myGen !== window.__ANKI_TTS_GEN__ || !window.__ANKI_IS_SPEAKING__) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                return;
            }

            var elapsed = Date.now() - startTime;
            if (elapsed > maxDurationMs) {
                clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                window.__ANKI_WATCHDOG_TIMER__ = null;
                if (myGen === window.__ANKI_TTS_GEN__) {
                    window.__ANKI_IS_SPEAKING__ = false;
                    setBtnState(triggerBtn, 'idle');
                }
                return;
            }

            try {
                var p = droidApi.ankiTtsIsSpeaking();
                if (p && typeof p.then === 'function') {
                    p.then(function(speaking) {
                        if (myGen !== window.__ANKI_TTS_GEN__) return;
                        if (speaking === true) {
                            sawSpeaking = true;
                            notSpeakingCount = 0;
                        } else if (speaking === false) {
                            if (sawSpeaking || elapsed > 1000) {
                                notSpeakingCount++;
                                if (notSpeakingCount >= 2) {
                                    clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                                    window.__ANKI_WATCHDOG_TIMER__ = null;
                                    window.__ANKI_IS_SPEAKING__ = false;
                                    setBtnState(triggerBtn, 'idle');
                                }
                            }
                        }
                    }).catch(function() {});
                }
            } catch(e) {}
        }, 350);
    }

    function falarNativo(textoLimpo, triggerBtn, targetName) {
        window.stopAllAudio();
        var myGen = window.__ANKI_TTS_GEN__;
        window.__ANKI_IS_SPEAKING__ = true;
        window.__ANKI_SPEAKING_TARGET__ = targetName || 'comment';
        setBtnState(triggerBtn, 'speaking');

        window.__ANKI_NATIVE_TIMER__ = setTimeout(function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;

            // 1. Tenta SpeechSynthesis padrão com divisão em frases e anti-sleep
            if ('speechSynthesis' in window) {
                try {
                    falarComSpeechSynthesis(textoLimpo, triggerBtn, myGen);
                    return;
                } catch(e) {}
            }

            // 2. Fallback para API AnkiDroidJS se SpeechSynthesis não estiver disponível
            if (falarAnkiDroidJS(textoLimpo, triggerBtn, myGen)) {
                return;
            }

            setBtnState(triggerBtn, 'idle');
            window.__ANKI_IS_SPEAKING__ = false;
        }, 50);
    }

    function falarElevenReader(textoLimpo, triggerBtn, side, targetName) {
        window.stopAllAudio();
        var myGen = window.__ANKI_TTS_GEN__;
        window.__ANKI_IS_SPEAKING__ = true;
        window.__ANKI_SPEAKING_TARGET__ = targetName || 'comment';
        setBtnState(triggerBtn, 'loading');

        // Se for Android, não tenta ElevenReader na porta 8766 (PC); vai direto para o TTS nativo
        if (isAndroid) {
            falarNativo(textoLimpo, triggerBtn, targetName);
            return;
        }

        var port = window.__ELEVEN_PORT__ || 8766;
        var streamUrl = "http://127.0.0.1:" + port + "/speak?side=" + encodeURIComponent(side || 'back') + "&text=" + encodeURIComponent(textoLimpo);

        function tocarAudioMonitorado(srcUrl) {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            var audio = new Audio(srcUrl);
            window.__ANKI_GLOBAL_STREAM__ = audio;

            var lastTime = -1;
            var stallTicks = 0;

            audio.oncanplay = function() {
                if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) return;
                setBtnState(triggerBtn, 'speaking');
            };

            audio.onended = function() {
                if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                    window.stopAllAudio();
                }
            };

            audio.onerror = function() {
                if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                    window.stopAllAudio();
                    falarNativo(textoLimpo, triggerBtn, targetName);
                }
            };

            if (window.__ANKI_WATCHDOG_TIMER__) clearInterval(window.__ANKI_WATCHDOG_TIMER__);
            window.__ANKI_WATCHDOG_TIMER__ = setInterval(function() {
                if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) {
                    clearInterval(window.__ANKI_WATCHDOG_TIMER__);
                    window.__ANKI_WATCHDOG_TIMER__ = null;
                    return;
                }
                if (audio.ended) {
                    window.stopAllAudio();
                    return;
                }
                if (audio.duration && isFinite(audio.duration) && audio.duration > 0 && audio.currentTime >= audio.duration - 0.06) {
                    window.stopAllAudio();
                    return;
                }
                if (audio.currentTime > 0) {
                    if (audio.paused) {
                        window.stopAllAudio();
                        return;
                    }
                    if (Math.abs(audio.currentTime - lastTime) < 0.001) {
                        stallTicks++;
                        if (stallTicks >= 4) {
                            window.stopAllAudio();
                            return;
                        }
                    } else {
                        stallTicks = 0;
                        lastTime = audio.currentTime;
                    }
                }
            }, 180);

            var playPromise = audio.play();
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise.then(function() {
                    if (myGen === window.__ANKI_TTS_GEN__ && window.__ANKI_GLOBAL_STREAM__ === audio) {
                        setBtnState(triggerBtn, 'speaking');
                    }
                }).catch(function(err) {
                    if (myGen !== window.__ANKI_TTS_GEN__ || window.__ANKI_GLOBAL_STREAM__ !== audio) return;
                    if (err && err.name === 'NotAllowedError') {
                        console.warn('[ElevenReader TTS] Autoplay bloqueado pelo WebEngine/navegador.');
                        setBtnState(triggerBtn, 'idle');
                        window.__ANKI_IS_SPEAKING__ = false;
                        return;
                    }
                });
            }
        }

        var xhr = new XMLHttpRequest();
        window.__ANKI_ACTIVE_XHR__ = xhr;
        xhr.open('GET', streamUrl, true);
        xhr.responseType = 'blob';
        xhr.onload = function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            window.__ANKI_ACTIVE_XHR__ = null;
            if (xhr.status === 200 && xhr.response && xhr.response.size > 128) {
                var blobUrl = URL.createObjectURL(xhr.response);
                window.__ANKI_BLOB_URL__ = blobUrl;
                tocarAudioMonitorado(blobUrl);
            } else {
                window.stopAllAudio();
                falarNativo(textoLimpo, triggerBtn, targetName);
            }
        };
        xhr.onerror = function() {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            window.__ANKI_ACTIVE_XHR__ = null;
            window.stopAllAudio();
            falarNativo(textoLimpo, triggerBtn, targetName);
        };
        try {
            xhr.send();
        } catch(e) {
            window.__ANKI_ACTIVE_XHR__ = null;
            tocarAudioMonitorado(streamUrl);
        }
    }

    function checarAddonPC(callback) {
        if (window.__HAS_ELEVEN_ADDON__ === true) {
            callback(true);
            return;
        }
        var cached = sessionStorage.getItem('has_eleven_addon');
        if (cached === 'true') { callback(true); return; }
        if (cached === 'false') { callback(false); return; }

        var port = window.__ELEVEN_PORT__ || 8766;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'http://127.0.0.1:' + port + '/status', true);
        xhr.timeout = 1200;
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (typeof window.__anki_autoplay === 'undefined' && typeof data.autoplay !== 'undefined') {
                        window.__anki_autoplay = data.autoplay;
                    }
                } catch(e) {}
                window.__HAS_ELEVEN_ADDON__ = true;
                sessionStorage.setItem('has_eleven_addon', 'true');
                callback(true);
            } else {
                sessionStorage.setItem('has_eleven_addon', 'false');
                callback(false);
            }
        };
        xhr.onerror = function() { callback(false); };
        xhr.ontimeout = function() { callback(false); };
        try { xhr.send(); } catch(e) { callback(false); }
    }

    function executarFala(textoLimpo, triggerBtn, side, targetName) {
        if (!textoLimpo) return;

        if (isAndroid) {
            falarNativo(textoLimpo, triggerBtn, targetName);
            return;
        }

        var myGen = window.__ANKI_TTS_GEN__;
        checarAddonPC(function(temAddon) {
            if (myGen !== window.__ANKI_TTS_GEN__) return;
            if (temAddon) {
                falarElevenReader(textoLimpo, triggerBtn, side || 'back', targetName);
            } else {
                falarNativo(textoLimpo, triggerBtn, targetName);
            }
        });
    }

    window.startCommentTTS = function() {
        var answerEl = document.getElementById('answer');
        var commentEl = document.getElementById('comment-box');
        var btn = document.getElementById('btn-tts-comment');
        var ans = extrairTextoElemento(answerEl);
        var com = extrairTextoElemento(commentEl);
        var txt = ((ans ? ans + '. ' : '') + com).replace(/\s+/g, ' ').trim();
        if (txt) executarFala(txt, btn, 'back', 'comment');
    };

    window.startExplainTTS = function() {
        var expBody = document.getElementById('explanation-body');
        var btn = document.getElementById('btn-tts-explain');
        var txt = extrairTextoElemento(expBody);
        if (txt) executarFala(txt, btn, 'explain', 'explain');
    };

    window.__LAST_TTS_TIME__ = 0;
    window.__TTS_STARTED_AT__ = 0;
    window.safeToggleTTS = function(target) {
        var now = Date.now();
        if (now - window.__LAST_TTS_TIME__ < 600) return;
        window.__LAST_TTS_TIME__ = now;

        if (window.__ANKI_IS_SPEAKING__) {
            var currentTarget = window.__ANKI_SPEAKING_TARGET__;
            if (now - (window.__TTS_STARTED_AT__ || 0) < 800) {
                return;
            }
            window.stopAllAudio();
            if (target === 'auto_back' || target === currentTarget) {
                return;
            }
        }
        window.__TTS_STARTED_AT__ = now;

        if (target === 'comment') {
            window.startCommentTTS();
        } else if (target === 'explain') {
            window.startExplainTTS();
        } else if (target === 'auto_back') {
            var expContent = document.getElementById('explanation-content');
            var isExpOpen = expContent && window.getComputedStyle(expContent).display !== 'none';
            if (isExpOpen) {
                window.startExplainTTS();
            } else {
                window.startCommentTTS();
            }
        }
    };

    window.toggleCommentTTS = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        window.safeToggleTTS('comment');
    };

    window.toggleExplainTTS = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        window.safeToggleTTS('explain');
    };

    function extractCleanCodeFromElement(el) {
        var html = el.innerHTML;
        html = html.replace(/<br\s*\/?>/gi, '\n')
                   .replace(/<\/div>\s*<div>/gi, '\n')
                   .replace(/<div>/gi, '\n')
                   .replace(/<\/div>/gi, '');

        var txt = document.createElement('textarea');
        txt.innerHTML = html;
        var clean = txt.value;
        clean = clean.replace(/\u00A0/g, ' ').trim();
        return clean;
    }

    var expContainer = document.getElementById('explanation-content');
    if (expContainer) {
        var rawNodes = expContainer.querySelectorAll('pre.mermaid, .mermaid');
        for (var k = 0; k < rawNodes.length; k++) {
            var rNode = rawNodes[k];
            if (!rNode.querySelector('svg') && !rNode.getAttribute('data-raw-code')) {
                var savedCode = extractCleanCodeFromElement(rNode);
                if (savedCode) {
                    rNode.setAttribute('data-raw-code', savedCode);
                }
            }
            rNode.classList.remove('mermaid');
            rNode.classList.add('mermaid-pending');
        }
    }

    function initMermaidConfig() {
        var isNight = document.body.classList.contains('nightMode') || 
                      document.documentElement.classList.contains('nightMode');
        window.mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'loose',
            theme: isNight ? 'dark' : 'default',
            themeVariables: {
                fontFamily: 'Inter, -apple-system, sans-serif',
                fontSize: '15px'
            },
            flowchart: { 
                useMaxWidth: false,
                htmlLabels: true,
                nodeSpacing: 30,
                rankSpacing: 35,
                padding: 12
            }
        });
    }

    function ensureMermaidLoaded(callback) {
        if (typeof window.mermaid !== 'undefined') {
            try { initMermaidConfig(); } catch(e) {}
            callback();
            return;
        }

        var script = document.createElement('script');
        script.src = '_mermaid.min.js';
        script.onload = function() {
            try { initMermaidConfig(); } catch(e) {}
            callback();
        };
        document.head.appendChild(script);
    }

    async function renderMermaidDiagrams(container) {
        var nodes = container.querySelectorAll('.mermaid-pending, pre.mermaid');
        if (!nodes.length) return;

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (node.getAttribute('data-mermaid-rendered') === 'true') continue;

            var rawCode = node.getAttribute('data-raw-code') || extractCleanCodeFromElement(node);
            if (!rawCode) continue;
            node.setAttribute('data-raw-code', rawCode);

            try {
                node.innerHTML = '';
                node.removeAttribute('data-processed');
                node.classList.remove('mermaid-pending');
                node.classList.add('mermaid');

                var uniqueId = 'mmd-svg-' + Date.now() + '-' + i;
                var result = await window.mermaid.render(uniqueId, rawCode, node);
                node.innerHTML = result.svg;
                node.setAttribute('data-mermaid-rendered', 'true');
            } catch (err) {
                console.error('Erro Mermaid:', err);
                node.innerHTML = '<div style="color:#ff7675; font-family:monospace; font-size:12px; padding:8px; border:1px solid #ff7675; border-radius:6px;">' +
                                 '<b>Erro Mermaid:</b><br>' + (err.message || err) +
                                 '<hr><pre style="text-align:left; color:#888;">' + rawCode + '</pre></div>';
            }
        }
    }

    // Controle Global e Persistente de Reprodução Automática (Auto / Manual)
    function obterAutoplayPref() {
        try {
            var saved = localStorage.getItem('anki_user_autoplay');
            if (saved === 'true') return true;
            if (saved === 'false') return false;
        } catch (e) {}
        if (typeof window.__anki_autoplay !== 'undefined') {
            return Boolean(window.__anki_autoplay);
        }
        // No Android, se não houver escolha salva, inicia em Manual (Silencioso)
        return false;
    }

    function atualizarBotaoAutoplay(ativo) {
        var btns = document.querySelectorAll('.btn-autoplay');
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var lbl = b.querySelector('.autoplay-label');
            if (ativo) {
                b.classList.add('is-active');
                b.classList.remove('is-manual');
                if (lbl) lbl.textContent = 'Auto';
                b.setAttribute('title', 'Reprodução Automática: ATIVADA (Toque para mudar para Manual)');
            } else {
                b.classList.remove('is-active');
                b.classList.add('is-manual');
                if (lbl) lbl.textContent = 'Manual';
                b.setAttribute('title', 'Reprodução Automática: MANUAL/SILENCIOSO (Toque para ativar Auto)');
            }
        }
    }

    window.toggleAutoplayPref = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        var novo = !obterAutoplayPref();
        try {
            localStorage.setItem('anki_user_autoplay', novo ? 'true' : 'false');
        } catch (e) {}
        window.__anki_autoplay = novo;
        atualizarBotaoAutoplay(novo);
        if (novo && !window.__ANKI_IS_SPEAKING__) {
            if (typeof window.startFrontTTS === 'function') {
                window.startFrontTTS();
            } else if (typeof window.startCommentTTS === 'function') {
                window.startCommentTTS();
            }
        }
    };

    function verificarAutoplayPermitido(callback) {
        try {
            var saved = localStorage.getItem('anki_user_autoplay');
            if (saved === 'true' || saved === 'false') {
                var val = (saved === 'true');
                atualizarBotaoAutoplay(val);
                callback(val);
                return;
            }
        } catch (e) {}

        if (typeof window.__anki_autoplay !== 'undefined') {
            var ap = Boolean(window.__anki_autoplay);
            atualizarBotaoAutoplay(ap);
            callback(ap);
            return;
        }

        if (isAndroid) {
            atualizarBotaoAutoplay(false);
            callback(false);
            return;
        }

        checarAddonPC(function() {
            var ap = (typeof window.__anki_autoplay !== 'undefined') ? Boolean(window.__anki_autoplay) : true;
            atualizarBotaoAutoplay(ap);
            callback(ap);
        });
    }

    atualizarBotaoAutoplay(obterAutoplayPref());

    
    

    
    function obterFrontBackPref() {
        try {
            var saved = localStorage.getItem('anki_user_show_front_on_back');
            if (saved === 'false') return false;
            if (saved === 'true') return true;
        } catch (e) {}
        if (typeof window.__anki_show_front_on_back !== 'undefined') {
            return Boolean(window.__anki_show_front_on_back);
        }
        return true;
    }

    function atualizarBotaoFrontBack(ativo) {
        var btns = document.querySelectorAll('.btn-toggle-front');
        var boxes = document.querySelectorAll('.front-back-box, .question-back-box');
        for (var j = 0; j < boxes.length; j++) {
            boxes[j].style.display = ativo ? 'block' : 'none';
        }
        for (var i = 0; i < btns.length; i++) {
            var b = btns[i];
            var lbl = b.querySelector('.front-label');
            if (ativo) {
                b.classList.add('is-active');
                b.classList.remove('is-inactive');
                if (lbl) lbl.textContent = 'Frente';
                b.setAttribute('title', 'Exibição da Frente no Verso: ATIVADA (Toque para ocultar | Atalho: F)');
            } else {
                b.classList.remove('is-active');
                b.classList.add('is-inactive');
                if (lbl) lbl.textContent = 'Frente';
                b.setAttribute('title', 'Exibição da Frente no Verso: DESATIVADA (Toque para mostrar | Atalho: F)');
            }
        }
    }

    window.toggleFrontBackPref = function(event) {
        if (event) { event.preventDefault(); event.stopPropagation(); }
        var novo = !obterFrontBackPref();
        try {
            localStorage.setItem('anki_user_show_front_on_back', novo ? 'true' : 'false');
        } catch (e) {}
        window.__anki_show_front_on_back = novo;
        atualizarBotaoFrontBack(novo);
    };

    // Aplicação imediata ao renderizar o verso do card
    atualizarBotaoFrontBack(obterFrontBackPref());

    window.toggleExplanation = function(event) {
        if (event) event.preventDefault();
        window.stopAllAudio();
        var myGen = window.__ANKI_TTS_GEN__;

        if (window.__ANKI_TOGGLE_EXP_TIMER__) {
            clearTimeout(window.__ANKI_TOGGLE_EXP_TIMER__);
            window.__ANKI_TOGGLE_EXP_TIMER__ = null;
        }

        var content = document.getElementById('explanation-content');
        var commentBox = document.getElementById('comment-box');
        var btn = document.getElementById('btn-explain');
        var btnTtsExp = document.getElementById('btn-tts-explain');
        if (!content || !btn) return;

        var isHidden = window.getComputedStyle(content).display === 'none';

        if (isHidden) {
            if (commentBox) commentBox.style.animation = 'fadeOut 0.2s ease-in-out forwards';
            window.__ANKI_TOGGLE_EXP_TIMER__ = setTimeout(function() {
                if (commentBox) commentBox.style.display = 'none';
                content.style.display = 'block';
                triggerMathJaxRender();
                setTimeout(triggerMathJaxRender, 60);
                content.style.animation = 'fadeIn 0.25s ease-in-out forwards';
                btn.innerHTML = 'Ocultar';
                btn.classList.add('active');
                if (btnTtsExp) btnTtsExp.style.display = 'inline-flex';

                setTimeout(function() {
                    ensureMermaidLoaded(function() {
                        renderMermaidDiagrams(content);
                    });
                }, 80);

                verificarAutoplayPermitido(function(permitido) {
                    if (permitido) {
                        window.__ANKI_EXPLAIN_TIMER__ = setTimeout(function() {
                            if (myGen === window.__ANKI_TTS_GEN__) {
                                window.startExplainTTS();
                            }
                        }, 220);
                    }
                });
            }, 200);
        } else {
            content.style.animation = 'fadeOut 0.2s ease-in-out forwards';
            window.__ANKI_TOGGLE_EXP_TIMER__ = setTimeout(function() {
                content.style.display = 'none';
                if (btnTtsExp) btnTtsExp.style.display = 'none';
                if (commentBox) {
                    commentBox.style.display = 'block';
                    commentBox.style.animation = 'fadeIn 0.25s ease-in-out forwards';
                }
                btn.innerHTML = 'Explicar';
                btn.classList.remove('active');
            }, 200);
        }
    };

    function handleKeyEvents(e) {
        var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || (e.target && e.target.isContentEditable)) return;

        var ankiAnswerCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Space', 'Enter', 'NumpadEnter'];
        var ankiAnswerKeys = ['1', '2', '3', '4', ' ', 'Enter'];
        if (ankiAnswerCodes.includes(e.code) || ankiAnswerKeys.includes(e.key)) {
            window.stopAllAudio();
            return;
        }

        var key = (e.key || '').toLowerCase();
        if (key === 'f' || key === 'p') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.toggleFrontBackPref === 'function') {
                window.toggleFrontBackPref();
            }
        } else if (key === 'x') {
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.toggleExplanation === 'function') {
                window.toggleExplanation();
            }
        } else if (key === 'r' || key === 'a') {
            e.preventDefault();
            e.stopPropagation();
            if (!window.__HAS_ELEVEN_ADDON__) {
                window.safeToggleTTS('auto_back');
            }
        }
    }

    if (window.__ANKI_KEYDOWN_HANDLER__) {
        window.removeEventListener('keydown', window.__ANKI_KEYDOWN_HANDLER__, true);
    }
    window.__ANKI_KEYDOWN_HANDLER__ = handleKeyEvents;
    window.addEventListener('keydown', window.__ANKI_KEYDOWN_HANDLER__, true);

    if (window.__ANKI_UNLOAD_HANDLER__) {
        window.removeEventListener('beforeunload', window.__ANKI_UNLOAD_HANDLER__);
        window.removeEventListener('pagehide', window.__ANKI_UNLOAD_HANDLER__);
    }
    window.__ANKI_UNLOAD_HANDLER__ = function() { window.stopAllAudio(); };
    window.addEventListener('beforeunload', window.__ANKI_UNLOAD_HANDLER__);
    window.addEventListener('pagehide', window.__ANKI_UNLOAD_HANDLER__);

    // Bloqueia reprodução em segundo plano no Android (para o áudio ao sair do app ou apagar a tela)
    if (window.__ANKI_VISIBILITY_HANDLER__) {
        document.removeEventListener('visibilitychange', window.__ANKI_VISIBILITY_HANDLER__);
        window.removeEventListener('blur', window.__ANKI_VISIBILITY_HANDLER__);
    }
    window.__ANKI_VISIBILITY_HANDLER__ = function() {
        if (document.hidden || document.visibilityState === 'hidden') {
            window.stopAllAudio();
        }
    };
    document.addEventListener('visibilitychange', window.__ANKI_VISIBILITY_HANDLER__);
    window.addEventListener('blur', function() {
        if (isAndroid) {
            window.stopAllAudio();
        }
    });

    var initGen = window.__ANKI_TTS_GEN__;

    window.__ANKI_AUTOPLAY_TIMER__ = setTimeout(function() {
        if (initGen !== window.__ANKI_TTS_GEN__) return;
        verificarAutoplayPermitido(function(permitido) {
            if (initGen !== window.__ANKI_TTS_GEN__) return;
            if (permitido && !window.__ANKI_IS_SPEAKING__) {
                window.startCommentTTS();
            }
        });
    }, 460);
})();

    }
})();
