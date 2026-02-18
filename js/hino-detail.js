/**
 * HARPA CRISTÃ - Hymn Detail Page Logic
 * Gerencia exibição do hino, áudio, cifras e navegação
 */

$(document).ready(function () {
    'use strict';

    // ===== STATE =====
    var currentHymn = null;
    var currentAudio = null;
    var isPlaying = false;
    var currentFontSize = 16;
    var audioType = '';

    // ===== INITIALIZATION =====
    function init() {
        var params = new URLSearchParams(window.location.search);
        var numero = parseInt(params.get('n'));

        if (!numero || !HINOS_DATA) {
            window.location.href = 'index.html';
            return;
        }

        // Find hymn
        currentHymn = null;
        for (var i = 0; i < HINOS_DATA.length; i++) {
            if (HINOS_DATA[i].numero === numero) {
                currentHymn = HINOS_DATA[i];
                break;
            }
        }

        if (!currentHymn) {
            window.location.href = 'index.html';
            return;
        }

        // Add to recents
        if (window.HarpaApp) {
            window.HarpaApp.addRecent(numero);
        }

        // Update page title
        document.title = 'Hino ' + currentHymn.numero + ' - ' + currentHymn.titulo + ' | Harpa Cristã';

        // Restore font size
        var savedFontSize = localStorage.getItem('harpa_font_size');
        if (savedFontSize) {
            currentFontSize = parseInt(savedFontSize);
        }

        // Render
        renderHeader();
        renderLyrics();
        renderChords();
        renderNavigation();
        setupEventHandlers();
        setupAudioPlayer();
        setupScrollTop();
        updateFontSize();

        // Navbar scroll
        $(window).on('scroll', function () {
            if ($(this).scrollTop() > 50) {
                $('#mainNavbar').addClass('scrolled');
            } else {
                $('#mainNavbar').removeClass('scrolled');
            }
        });
    }

    // ===== RENDER HEADER =====
    function renderHeader() {
        $('#hymnNumber').text(currentHymn.numero);
        $('#hymnTitle').text(currentHymn.titulo);

        // Check favorite status
        if (window.HarpaApp) {
            var favs = window.HarpaApp.getFavorites();
            if (favs.indexOf(currentHymn.numero) > -1) {
                $('#btnFavorite').addClass('favorited');
                $('#btnFavorite i').removeClass('bi-heart').addClass('bi-heart-fill');
            }
        }
    }

    // ===== RENDER LYRICS =====
    function renderLyrics() {
        var $container = $('#lyricsContent');
        $container.empty();

        var localLetra = localStorage.getItem('harpa_letra_' + currentHymn.numero);

        if (localLetra) {
            // Render overridden lyrics (plain text)
            $container.append('<div class="alert alert-info py-2 mb-3 d-flex align-items-center justify-content-between" style="font-size:0.8rem">' +
                '<span><i class="bi bi-info-circle me-1"></i> Esta letra foi modificada por você.</span>' +
                '<div>' +
                '<a href="#" id="btnEditLetra" class="alert-link ms-2"><i class="bi bi-pencil-square"></i> Editar</a>' +
                '<a href="#" id="btnResetLetra" class="alert-link ms-3 text-muted" style="text-decoration:none">Excluir</a>' +
                '</div></div>');

            var $pre = $('<div class="lyrics-verse"><div class="verse-text" style="white-space: pre-wrap;">' + escapeHtml(localLetra) + '</div></div>');
            $container.append($pre);

            $('#btnEditLetra').on('click', function (e) { e.preventDefault(); renderEditor($container, 'letra', localLetra); });
            $('#btnResetLetra').on('click', function (e) {
                e.preventDefault();
                if (confirm('Deseja excluir a letra personalizada?')) {
                    localStorage.removeItem('harpa_letra_' + currentHymn.numero);
                    renderLyrics();
                }
            });
            return;
        }

        if (!currentHymn.letra || !currentHymn.letra.versos) {
            $container.html('<div class="text-center text-muted py-5">' +
                '<i class="bi bi-file-text" style="font-size:3rem;opacity:0.3"></i>' +
                '<p class="mt-3">Letra não disponível</p>' +
                '<button class="btn btn-sm btn-outline-primary" id="btnCreateLetra">Adicionar Letra</button></div>');

            $('#btnCreateLetra').on('click', function () { renderEditor($container, 'letra', ''); });
            return;
        }

        // Add Edit button for original lyrics
        $container.append('<div class="text-end mb-3"><button class="btn btn-sm btn-outline-secondary" id="btnEditOriginalLetra"><i class="bi bi-pencil"></i> Editar Letra</button></div>');

        currentHymn.letra.versos.forEach(function (verso) {
            var labelClass = verso.tipo === 'coro' ? 'chorus-label' : '';
            var labelText = '';

            if (verso.tipo === 'coro') {
                labelText = 'Coro';
            } else if (verso.tipo === 'verso') {
                labelText = 'Verso ' + (verso.numero || '');
            }

            var html = '<div class="lyrics-verse fade-in">' +
                '<div class="verse-label ' + labelClass + '">' + labelText + '</div>' +
                '<div class="verse-text">' + escapeHtml(verso.texto) + '</div>' +
                '</div>';

            $container.append(html);
        });

        $('#btnEditOriginalLetra').on('click', function () {
            var text = currentHymn.letra.versos.map(function (v) {
                var prefix = v.tipo === 'coro' ? '[Coro]\n' : (v.numero ? '[Verso ' + v.numero + ']\n' : '[Verso]\n');
                return prefix + v.texto;
            }).join('\n\n');
            renderEditor($container, 'letra', text);
        });
    }

    // ===== RENDER CHORDS =====
    function renderChords() {
        var $container = $('#chordsContent');
        $container.empty();

        var localCifra = localStorage.getItem('harpa_cifra_' + currentHymn.numero);
        var chordsText = localCifra || currentHymn.cifras;

        var isMissing = !chordsText ||
            chordsText.indexOf('Em breve') > -1 ||
            chordsText.indexOf('disponíveis') > -1;

        if (isMissing && !localCifra) {
            renderEditor($container, 'cifra');
            return;
        }

        // Add Edit button for chords
        var alertHtml = localCifra ?
            '<div class="alert alert-info py-2 mb-3 d-flex align-items-center justify-content-between" style="font-size:0.8rem">' +
            '<span><i class="bi bi-info-circle me-1"></i> Esta cifra foi modificada por você.</span>' +
            '<div>' +
            '<a href="#" id="btnEditCifra" class="alert-link ms-2"><i class="bi bi-pencil-square"></i> Editar</a>' +
            '<a href="#" id="btnResetCifra" class="alert-link ms-3 text-muted" style="text-decoration:none">Excluir</a>' +
            '</div></div>' :
            '<div class="text-end mb-3"><button class="btn btn-sm btn-outline-secondary" id="btnEditOriginalCifra"><i class="bi bi-pencil"></i> Editar Cifra</button></div>';

        $container.append(alertHtml);

        var lines = chordsText.split('\n');
        var $pre = $('<pre class="fade-in"></pre>');

        lines.forEach(function (line) {
            if (line.trim() === '') {
                $pre.append('\n');
                return;
            }

            var parts = line.split(/(\[[^\]]+\])/g);
            var $lineSpan = $('<span></span>');

            parts.forEach(function (part, index) {
                if (part && part.startsWith('[') && part.endsWith(']')) {
                    var chord = part.substring(1, part.length - 1);
                    var nextText = parts[index + 1] || '';
                    var match = nextText.match(/^(\s*\S+|\s+)/);
                    var word = match ? match[0] : '';

                    if (match) parts[index + 1] = nextText.substring(word.length);

                    var $chordRow = $('<div class="chord-row"></div>');
                    $chordRow.append('<span class="chord-highlight">' + escapeHtml(chord) + '</span>');
                    $chordRow.append('<span class="word-with-chord">' + (word.trim() === '' ? '&nbsp;' : escapeHtml(word)) + '</span>');
                    $lineSpan.append($chordRow);
                } else if (part && (part.trim().length > 0 || part === ' ')) {
                    $lineSpan.append('<span class="plain-word">' + escapeHtml(part) + '</span>');
                }
            });
            $pre.append($lineSpan).append('\n');
        });

        $container.append($pre);

        $('#btnEditCifra, #btnEditOriginalCifra').on('click', function (e) {
            e.preventDefault();
            renderEditor($container, 'cifra', chordsText);
        });

        $('#btnResetCifra').on('click', function (e) {
            e.preventDefault();
            if (confirm('Deseja excluir a cifra personalizada?')) {
                localStorage.removeItem('harpa_cifra_' + currentHymn.numero);
                renderChords();
            }
        });
    }

    function renderEditor($container, type, initialText) {
        var isCifra = type === 'cifra';
        var isEditing = !!initialText;
        var textValue = initialText || '';
        var searchUrl = 'https://www.google.com/search?q=harpa+crista+' + currentHymn.numero + '+' + encodeURIComponent(currentHymn.titulo) + '+' + type;

        var title = isEditing ? 'Editar ' + (isCifra ? 'Cifra' : 'Letra') : (isCifra ? 'Cifra' : 'Letra') + ' não disponível';
        var desc = isEditing ? 'Ajuste o texto abaixo e clique em salvar.' : 'Este hino ainda não possui ' + (isCifra ? 'cifras' : 'letra') + ' localmente. Deseja buscar na internet?';

        var html = '<div class="import-card fade-in">' +
            '<div class="import-icon"><i class="bi ' + (isEditing ? 'bi-pencil-square' : 'bi-cloud-download') + '"></i></div>' +
            '<h3 class="import-title">' + title + '</h3>' +
            '<p class="import-text">' + desc + '</p>' +
            '<div class="d-flex flex-wrap justify-content-center gap-3 ' + (isEditing ? 'd-none' : '') + '">' +
            '  <a href="' + searchUrl + '" target="_blank" class="btn-import">' +
            '    <i class="bi bi-search me-2"></i>Buscar na Internet' +
            '  </a>' +
            '  <button class="btn-import" style="background: var(--bg-glass); color: var(--text-primary); border: 1px solid var(--border-light)" id="btnShowEditor">' +
            '    <i class="bi bi-pencil-square me-2"></i>Colar Manualmente' +
            '  </button>' +
            '</div>' +
            '<div class="import-editor" id="importEditor" style="' + (isEditing ? 'display:block' : '') + '">' +
            '  <p class="mt-4 mb-2 text-start small text-muted">Cole a ' + (isCifra ? 'cifra' : 'letra') + ' abaixo:</p>' +
            '  <textarea class="import-textarea" id="importText" style="min-height:300px">' + escapeHtml(textValue) + '</textarea>' +
            '  <div class="d-flex gap-2 justify-content-end">' +
            '    <button class="btn btn-sm btn-outline-secondary" id="btnCancelImport">Cancelar</button>' +
            '    <button class="btn btn-sm btn-primary" id="btnSaveImport" style="background:var(--accent-gold); border:none; color:#000; font-weight:600">Salvar Alterações</button>' +
            '  </div>' +
            '</div>' +
            '</div>';

        $container.html(html);

        $('#btnShowEditor').on('click', function () {
            $('#importEditor').slideDown();
            $(this).closest('.import-card').find('.d-flex.gap-3').fadeOut();
        });

        $('#btnCancelImport').on('click', function () {
            if (isCifra) renderChords(); else renderLyrics();
        });

        $('#btnSaveImport').on('click', function () {
            var text = $('#importText').val().trim();
            if (text.length < 5) {
                alert('O conteúdo é muito curto.');
                return;
            }
            localStorage.setItem('harpa_' + type + '_' + currentHymn.numero, text);
            if (isCifra) renderChords(); else renderLyrics();
        });
    }

    // ===== RENDER NAVIGATION =====
    function renderNavigation() {
        var prevNum = currentHymn.numero - 1;
        var nextNum = currentHymn.numero + 1;

        // Find prev
        var prevHymn = null;
        var nextHymn = null;

        for (var i = 0; i < HINOS_DATA.length; i++) {
            if (HINOS_DATA[i].numero === prevNum) prevHymn = HINOS_DATA[i];
            if (HINOS_DATA[i].numero === nextNum) nextHymn = HINOS_DATA[i];
        }

        if (prevHymn) {
            $('#prevHymn').attr('href', 'hino.html?n=' + prevHymn.numero);
            $('#prevTitle').text(prevHymn.numero + '. ' + prevHymn.titulo);
        } else {
            $('#prevHymn').addClass('d-none');
        }

        if (nextHymn) {
            $('#nextHymn').attr('href', 'hino.html?n=' + nextHymn.numero);
            $('#nextTitle').text(nextHymn.numero + '. ' + nextHymn.titulo);
        } else {
            $('#nextHymn').addClass('d-none');
        }
    }

    // ===== EVENT HANDLERS =====
    function setupEventHandlers() {
        // Favorite button
        $('#btnFavorite').on('click', function () {
            if (window.HarpaApp) {
                var isFav = window.HarpaApp.toggleFavorite(currentHymn.numero);
                if (isFav) {
                    $(this).addClass('favorited');
                    $(this).find('i').removeClass('bi-heart').addClass('bi-heart-fill');
                    $(this).find('span').text('Favoritado');
                } else {
                    $(this).removeClass('favorited');
                    $(this).find('i').removeClass('bi-heart-fill').addClass('bi-heart');
                    $(this).find('span').text('Favorito');
                }
            }
        });

        // Cifras button - switch to tab
        $('#btnCifras').on('click', function () {
            var tabEl = document.getElementById('tab-cifras');
            var tab = new bootstrap.Tab(tabEl);
            tab.show();
            $('html, body').animate({ scrollTop: $('.content-tabs').offset().top - 70 }, 300);
        });

        // Play buttons
        $('#btnPlaySung').on('click', function () {
            playAudio('cantado');
        });

        $('#btnPlayBack').on('click', function () {
            playAudio('playback');
        });

        // Font size controls
        $('#fontIncrease').on('click', function () {
            if (currentFontSize < 28) {
                currentFontSize += 2;
                updateFontSize();
            }
        });

        $('#fontDecrease').on('click', function () {
            if (currentFontSize > 12) {
                currentFontSize -= 2;
                updateFontSize();
            }
        });

        // Keyboard navigation
        $(document).on('keydown', function (e) {
            if (e.key === 'ArrowLeft') {
                var prevLink = $('#prevHymn').attr('href');
                if (prevLink && prevLink !== '#') window.location.href = prevLink;
            }
            if (e.key === 'ArrowRight') {
                var nextLink = $('#nextHymn').attr('href');
                if (nextLink && nextLink !== '#') window.location.href = nextLink;
            }
            if (e.key === ' ' && isPlaying) {
                e.preventDefault();
                togglePlayPause();
            }
        });
    }

    // ===== FONT SIZE =====
    function updateFontSize() {
        $('.verse-text').css('font-size', currentFontSize + 'px');
        $('.chords-verse pre').css('font-size', (currentFontSize - 2) + 'px');
        $('#fontSizeLabel').text(currentFontSize + 'px');
        localStorage.setItem('harpa_font_size', currentFontSize.toString());
    }

    // ===== AUDIO PLAYER =====
    function setupAudioPlayer() {
        var $audio = $('#audioElement')[0];

        // Player play/pause
        $('#playerPlayPause').on('click', function () {
            togglePlayPause();
        });

        // Player close
        $('#playerClose').on('click', function () {
            stopAudio();
        });

        // Progress bar click
        $('#playerProgressBar').on('click', function (e) {
            if ($audio && $audio.duration) {
                var rect = this.getBoundingClientRect();
                var pos = (e.clientX - rect.left) / rect.width;
                $audio.currentTime = pos * $audio.duration;
            }
        });

        // Volume toggle
        $('#playerVolume').on('click', function () {
            if ($audio) {
                $audio.muted = !$audio.muted;
                $(this).find('i')
                    .toggleClass('bi-volume-up', !$audio.muted)
                    .toggleClass('bi-volume-mute', $audio.muted);
            }
        });

        // Audio events
        $audio.addEventListener('timeupdate', function () {
            if ($audio.duration) {
                var progress = ($audio.currentTime / $audio.duration) * 100;
                $('#playerProgressFill').css('width', progress + '%');
                $('#playerCurrentTime').text(formatTime($audio.currentTime));
                $('#playerDuration').text(formatTime($audio.duration));
            }
        });

        $audio.addEventListener('ended', function () {
            isPlaying = false;
            $('#playerPlayPause i').removeClass('bi-pause-fill').addClass('bi-play-fill');
        });

        $audio.addEventListener('error', function () {
            showAudioNotice();
        });
    }

    function playAudio(type) {
        audioType = type;
        var typeLabel = type === 'cantado' ? 'Cantado' : 'Playback';

        // Show player bar
        $('#audioPlayerBar').addClass('active');
        $('#playerTitle').text(currentHymn.numero + '. ' + currentHymn.titulo);
        $('#playerType').text(typeLabel);

        // Try to load audio file
        // Audio files should be in: audio/cantado/001.mp3 or audio/playback/001.mp3
        var audioPath = 'audio/' + type + '/' + padNumber(currentHymn.numero, 3) + '.mp3';
        var $audio = $('#audioElement')[0];

        $audio.src = audioPath;
        $audio.load();

        $audio.play().then(function () {
            isPlaying = true;
            $('#playerPlayPause i').removeClass('bi-play-fill').addClass('bi-pause-fill');

            // Update button state
            if (type === 'cantado') {
                $('#btnPlaySung').html('<i class="bi bi-pause-circle"></i><span>Pausar</span>');
            } else {
                $('#btnPlayBack').html('<i class="bi bi-pause-circle"></i><span>Pausar</span>');
            }
        }).catch(function () {
            showAudioNotice();
        });
    }

    function togglePlayPause() {
        var $audio = $('#audioElement')[0];
        if ($audio.paused) {
            $audio.play();
            isPlaying = true;
            $('#playerPlayPause i').removeClass('bi-play-fill').addClass('bi-pause-fill');
        } else {
            $audio.pause();
            isPlaying = false;
            $('#playerPlayPause i').removeClass('bi-pause-fill').addClass('bi-play-fill');
        }
    }

    function stopAudio() {
        var $audio = $('#audioElement')[0];
        $audio.pause();
        $audio.currentTime = 0;
        isPlaying = false;
        $('#audioPlayerBar').removeClass('active');
        $('#playerPlayPause i').removeClass('bi-pause-fill').addClass('bi-play-fill');
        $('#btnPlaySung').html('<i class="bi bi-play-circle"></i><span>Cantado</span>');
        $('#btnPlayBack').html('<i class="bi bi-music-note-beamed"></i><span>Playback</span>');
    }

    function showAudioNotice() {
        // Show a friendly notice that audio files need to be added
        var $playerBar = $('#audioPlayerBar');
        $playerBar.addClass('active');
        $('#playerTitle').text(currentHymn.titulo);
        $('#playerType').html(
            '<span style="color: var(--accent-gold)">' +
            '<i class="bi bi-info-circle me-1"></i>' +
            'Adicione os arquivos MP3 na pasta audio/' + audioType + '/' +
            '</span>'
        );

        setTimeout(function () {
            $playerBar.removeClass('active');
        }, 4000);
    }

    // ===== SCROLL TOP =====
    function setupScrollTop() {
        var $btn = $('#scrollTopBtn');
        $(window).on('scroll', function () {
            if ($(this).scrollTop() > 500) {
                $btn.addClass('visible');
            } else {
                $btn.removeClass('visible');
            }
        });
        $btn.on('click', function () {
            $('html, body').animate({ scrollTop: 0 }, 500);
        });
    }

    // ===== UTILITY =====
    function escapeHtml(text) {
        if (!text) return '';
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function (m) { return map[m]; });
    }

    function formatTime(seconds) {
        var min = Math.floor(seconds / 60);
        var sec = Math.floor(seconds % 60);
        return min + ':' + (sec < 10 ? '0' : '') + sec;
    }

    function padNumber(num, size) {
        var s = num.toString();
        while (s.length < size) s = '0' + s;
        return s;
    }

    // ===== START =====
    init();
});
