/**
 * HARPA CRISTÃ - Main Application Logic
 * Gerencia listagem, busca, filtros e favoritos
 */

$(document).ready(function () {
    'use strict';

    // ===== CONSTANTS =====
    var ITEMS_PER_PAGE = 50;
    var STORAGE_KEYS = {
        FAVORITES: 'harpa_favoritos',
        RECENT: 'harpa_recentes',
        VIEW_MODE: 'harpa_view_mode',
        FONT_SIZE: 'harpa_font_size'
    };

    // ===== STATE =====
    var state = {
        allHymns: [],
        filteredHymns: [],
        displayedCount: 0,
        currentFilter: 'all',
        currentLetter: 'all',
        currentView: 'list',
        searchTimeout: null,
        filterCantado: false,
        filterPlayback: false
    };

    // ===== INITIALIZATION =====
    function init() {
        // Load hymn data
        if (typeof HINOS_DATA !== 'undefined') {
            state.allHymns = HINOS_DATA.slice();

            // Carrega hinos personalizados do localStorage
            var customHymns = getCustomHymns();
            if (customHymns.length > 0) {
                state.allHymns = state.allHymns.concat(customHymns);
                // Ordena por número
                state.allHymns.sort(function (a, b) { return a.numero - b.numero; });
            }

            state.filteredHymns = state.allHymns.slice();
        }

        // Restore view mode
        var savedView = localStorage.getItem(STORAGE_KEYS.VIEW_MODE);
        if (savedView) {
            state.currentView = savedView;
        }

        // Setup UI
        setupSplashScreen();
        setupNavbar();
        setupSearch();
        setupFilters();
        setupAudioFilters();
        setupAlphabetFilter();
        setupViewToggle();
        setupScrollTop();
        setupCustomHymns(); // Setup "Novo Hino"
        createParticles();
        updateStats();
        renderHymns();

        // Hide splash
        setTimeout(function () {
            $('#splash-screen').addClass('hidden');
        }, 1800);
    }

    // ===== CUSTOM HYMNS =====
    function getCustomHymns() {
        try {
            var data = localStorage.getItem('harpa_hinos_custom');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function setupCustomHymns() {
        $('#btnAddHymn').on('click', function (e) {
            e.preventDefault();
            $('#modalNovoHino').modal('show');
        });

        $('#btnSalvarNovoHino').on('click', saveCustomHymn);
    }

    function saveCustomHymn() {
        var titulo = $('#novoTitulo').val().trim();
        var letraRaw = $('#novaLetra').val().trim();
        var cifra = $('#novaCifra').val().trim();

        if (!titulo || !letraRaw) {
            alert('Por favor, preencha o título e a letra.');
            return;
        }

        var customHymns = getCustomHymns();

        // Determina o próximo número (mínimo 1000)
        var nextNumber = 1000;
        if (customHymns.length > 0) {
            var maxNum = Math.max.apply(Math, customHymns.map(function (h) { return h.numero; }));
            nextNumber = Math.max(1000, maxNum + 1);
        }

        // Processa a letra em versos (separados por linha em branco)
        var estrofes = letraRaw.split(/\n\s*\n/);
        var versos = estrofes.map(function (texto, index) {
            return {
                tipo: 'verso',
                numero: index + 1,
                texto: texto.trim()
            };
        });

        var novoHino = {
            numero: nextNumber,
            titulo: titulo,
            letra: { versos: versos },
            cifras: cifra || "Cifra disponível em breve...",
            custom: true // Flag para identificar que é personalizado
        };

        customHymns.push(novoHino);
        localStorage.setItem('harpa_hinos_custom', JSON.stringify(customHymns));

        $('#modalNovoHino').modal('hide');
        $('#formNovoHino')[0].reset();

        alert('Hino #' + nextNumber + ' incluído com sucesso!');
        location.reload(); // Recarrega para atualizar a lista e stats
    }

    // ===== SPLASH SCREEN =====
    function setupSplashScreen() {
        // Already animated via CSS
    }

    // ===== NAVBAR =====
    function setupNavbar() {
        $(window).on('scroll', function () {
            if ($(this).scrollTop() > 50) {
                $('#mainNavbar').addClass('scrolled');
            } else {
                $('#mainNavbar').removeClass('scrolled');
            }
        });
    }

    // ===== PARTICLES =====
    function createParticles() {
        var container = $('#particles');
        if (!container.length) return;

        for (var i = 0; i < 30; i++) {
            var particle = $('<div class="particle"></div>');
            particle.css({
                left: Math.random() * 100 + '%',
                animationDuration: (Math.random() * 10 + 8) + 's',
                animationDelay: (Math.random() * 5) + 's',
                width: (Math.random() * 3 + 1) + 'px',
                height: (Math.random() * 3 + 1) + 'px'
            });
            container.append(particle);
        }
    }

    // ===== SEARCH =====
    function setupSearch() {
        var $input = $('#searchInput');
        var $clear = $('#searchClear');
        var $wrapper = $('.search-wrapper');

        $input.on('input', function () {
            var val = $(this).val().trim();
            $clear.toggleClass('d-none', val.length === 0);
            $wrapper.toggleClass('searching', val.length > 0);

            clearTimeout(state.searchTimeout);
            state.searchTimeout = setTimeout(function () {
                filterHymns();
                updateSearchTitle(val);
            }, 250);
        });

        $clear.on('click', function () {
            $input.val('');
            $clear.addClass('d-none');
            $wrapper.removeClass('searching');
            filterHymns();
            updateSearchTitle('');
            $input.focus();
        });

        // Search on enter
        $input.on('keydown', function (e) {
            if (e.key === 'Enter') {
                clearTimeout(state.searchTimeout);
                filterHymns();
                updateSearchTitle($input.val());
            }
        });
    }

    function updateSearchTitle(query) {
        var $title = $('.section-title h2');
        if (query.length > 0) {
            $title.html('<i class="bi bi-search me-2"></i>' + state.filteredHymns.length + ' hinos encontrados');
        } else {
            $title.text('Todos os Hinos');
        }
    }

    // ===== FILTERS =====
    function setupFilters() {
        $('.filter-btn[data-filter]').on('click', function () {
            var filter = $(this).data('filter');
            state.currentFilter = filter;
            $('.filter-btn[data-filter]').removeClass('active');
            $(this).addClass('active');
            filterHymns();
        });
    }

    // ===== AUDIO FILTERS (toggle) =====
    function setupAudioFilters() {
        $('.filter-toggle').on('click', function (e) {
            e.stopPropagation();
            var type = $(this).data('audio');
            if (type === 'cantado') {
                state.filterCantado = !state.filterCantado;
            } else if (type === 'playback') {
                state.filterPlayback = !state.filterPlayback;
            }
            $(this).toggleClass('active');
            filterHymns();
        });
    }

    // Helper: retorna o link de áudio salvo para um hino
    function getAudioLink(numero, type) {
        return localStorage.getItem('harpa_audio_' + type + '_' + numero) || '';
    }

    // ===== ALPHABET FILTER =====
    function setupAlphabetFilter() {
        var letters = [];
        var usedLetters = {};

        state.allHymns.forEach(function (hymn) {
            var first = hymn.titulo.charAt(0).toUpperCase();
            if (!usedLetters[first]) {
                usedLetters[first] = true;
                letters.push(first);
            }
        });

        letters.sort();

        var $container = $('#alphabetFilter');
        letters.forEach(function (letter) {
            $container.append(
                '<button class="alpha-btn" data-letter="' + letter + '">' + letter + '</button>'
            );
        });

        $container.on('click', '.alpha-btn', function () {
            var letter = $(this).data('letter');
            state.currentLetter = letter;
            $('.alpha-btn').removeClass('active');
            $(this).addClass('active');
            filterHymns();
        });
    }

    // ===== VIEW TOGGLE =====
    function setupViewToggle() {
        // Restore saved view
        updateViewMode(state.currentView);

        $('.view-btn').on('click', function () {
            var view = $(this).data('view');
            state.currentView = view;
            localStorage.setItem(STORAGE_KEYS.VIEW_MODE, view);
            $('.view-btn').removeClass('active');
            $(this).addClass('active');
            updateViewMode(view);
        });
    }

    function updateViewMode(view) {
        var $container = $('#hymnsContainer');
        $container.removeClass('list-view grid-view');
        $container.addClass(view + '-view');

        $('.view-btn').removeClass('active');
        $('.view-btn[data-view="' + view + '"]').addClass('active');
    }

    // ===== FILTER LOGIC =====
    function filterHymns() {
        var search = $('#searchInput').val().trim().toLowerCase();
        var favorites = getFavorites();
        var recents = getRecents();

        state.filteredHymns = state.allHymns.filter(function (hymn) {
            // Filter by category
            if (state.currentFilter === 'favorites') {
                if (favorites.indexOf(hymn.numero) === -1) return false;
            }
            if (state.currentFilter === 'recent') {
                if (recents.indexOf(hymn.numero) === -1) return false;
            }

            // Filter by audio links (AND logic when both active)
            if (state.filterCantado) {
                if (!getAudioLink(hymn.numero, 'cantado')) return false;
            }
            if (state.filterPlayback) {
                if (!getAudioLink(hymn.numero, 'playback')) return false;
            }

            // Filter by letter
            if (state.currentLetter !== 'all') {
                if (hymn.titulo.charAt(0).toUpperCase() !== state.currentLetter) return false;
            }

            // Filter by search
            if (search) {
                var matchNumber = hymn.numero.toString() === search;
                var matchTitle = hymn.titulo.toLowerCase().indexOf(search) > -1;
                var matchLyrics = false;

                if (hymn.letra && hymn.letra.versos) {
                    hymn.letra.versos.forEach(function (v) {
                        if (v.texto.toLowerCase().indexOf(search) > -1) {
                            matchLyrics = true;
                        }
                    });
                }

                if (!matchNumber && !matchTitle && !matchLyrics) return false;
            }

            return true;
        });

        // Sort recents by most recent
        if (state.currentFilter === 'recent') {
            state.filteredHymns.sort(function (a, b) {
                return recents.indexOf(a.numero) - recents.indexOf(b.numero);
            });
        }

        state.displayedCount = 0;
        renderHymns();
    }

    // ===== RENDER HYMNS =====
    function renderHymns() {
        var $container = $('#hymnsContainer');
        var $noResults = $('#noResults');
        var $loadMore = $('#loadMoreContainer');
        var $resultsCount = $('#resultsCount');

        if (state.displayedCount === 0) {
            $container.empty();
        }

        var start = state.displayedCount;
        var end = Math.min(start + ITEMS_PER_PAGE, state.filteredHymns.length);
        var favorites = getFavorites();

        if (state.filteredHymns.length === 0) {
            // Mensagem dinâmica baseada nos filtros de áudio
            var noResultsMsg = 'Nenhum hino encontrado';
            if (state.filterCantado && state.filterPlayback) {
                noResultsMsg = 'Não encontrei nenhum resultado para hinos com links Cantado e Playback';
            } else if (state.filterCantado) {
                noResultsMsg = 'Não encontrei nenhum resultado para hinos com link Cantado';
            } else if (state.filterPlayback) {
                noResultsMsg = 'Não encontrei nenhum resultado para hinos com link Playback';
            }
            $noResults.removeClass('d-none');
            $noResults.find('h3').text(noResultsMsg);
            $noResults.find('p').text(state.filterCantado || state.filterPlayback ? 'Adicione links de áudio nos hinos para que eles apareçam aqui.' : 'Tente buscar com outros termos');
            $loadMore.addClass('d-none');
            $resultsCount.text(noResultsMsg);
            return;
        }

        $noResults.addClass('d-none');

        for (var i = start; i < end; i++) {
            var hymn = state.filteredHymns[i];
            var isFav = favorites.indexOf(hymn.numero) > -1;
            var preview = '';

            if (hymn.letra && hymn.letra.versos && hymn.letra.versos[0]) {
                preview = hymn.letra.versos[0].texto.split('\n')[0];
                if (preview.length > 60) preview = preview.substring(0, 60) + '...';
            }

            var card = buildHymnCard(hymn, isFav, preview);
            $container.append(card);
        }

        state.displayedCount = end;

        // Update count
        $resultsCount.text(
            'Mostrando ' + state.displayedCount + ' de ' + state.filteredHymns.length + ' hinos'
        );

        // Show/hide load more
        if (state.displayedCount < state.filteredHymns.length) {
            $loadMore.removeClass('d-none');
        } else {
            $loadMore.addClass('d-none');
        }

        // Update view mode
        updateViewMode(state.currentView);
    }

    function buildHymnCard(hymn, isFav, preview) {
        var favClass = isFav ? ' favorited' : '';
        var favIcon = isFav ? 'bi-heart-fill' : 'bi-heart';

        return '<div class="hymn-card" data-numero="' + hymn.numero + '">' +
            '<div class="hymn-number">' + hymn.numero + '</div>' +
            '<div class="hymn-info" onclick="window.location.href=\'hino.html?n=' + hymn.numero + '\'">' +
            '<div class="hymn-title">' + escapeHtml(hymn.titulo) + '</div>' +
            '<div class="hymn-preview">' + escapeHtml(preview) + '</div>' +
            '</div>' +
            '<div class="hymn-actions">' +
            '<button class="hymn-action-btn btn-fav' + favClass + '" data-numero="' + hymn.numero + '" title="Favorito">' +
            '<i class="bi ' + favIcon + '"></i>' +
            '</button>' +
            '<button class="hymn-action-btn btn-open" onclick="window.location.href=\'hino.html?n=' + hymn.numero + '\'" title="Abrir hino">' +
            '<i class="bi bi-chevron-right"></i>' +
            '</button>' +
            '</div>' +
            '</div>';
    }

    // ===== LOAD MORE =====
    $('#loadMoreBtn').on('click', function () {
        renderHymns();
    });

    // ===== FAVORITES =====
    function getFavorites() {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function toggleFavorite(numero) {
        var favs = getFavorites();
        var idx = favs.indexOf(numero);
        if (idx > -1) {
            favs.splice(idx, 1);
        } else {
            favs.push(numero);
        }
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
        return favs.indexOf(numero) > -1;
    }

    // Event delegation for favorite buttons
    $(document).on('click', '.btn-fav', function (e) {
        e.stopPropagation();
        var numero = parseInt($(this).data('numero'));
        var isFav = toggleFavorite(numero);
        var $btn = $(this);

        if (isFav) {
            $btn.addClass('favorited');
            $btn.find('i').removeClass('bi-heart').addClass('bi-heart-fill');
        } else {
            $btn.removeClass('favorited');
            $btn.find('i').removeClass('bi-heart-fill').addClass('bi-heart');
        }

        updateStats();
    });

    // ===== RECENTS =====
    function getRecents() {
        try {
            var data = localStorage.getItem(STORAGE_KEYS.RECENT);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    // ===== STATS =====
    function updateStats() {
        var favs = getFavorites();
        $('#totalHymns').text(state.allHymns.length);
        $('#totalFavorites').text(favs.length);

        // Count hymns with detailed content
        var withContent = 0;
        state.allHymns.forEach(function (h) {
            if (h.letra && h.letra.versos && h.letra.versos.length > 1) {
                withContent++;
            }
        });
        $('#totalWithAudio').text(withContent);
    }

    // ===== SCROLL TO TOP =====
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

    // ===== START =====
    init();
});

// ===== GLOBAL FUNCTIONS (Defined outside ready for immediate access) =====
window.HarpaApp = {
    getFavorites: function () {
        try {
            var data = localStorage.getItem('harpa_favoritos');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },
    toggleFavorite: function (numero) {
        var favs = this.getFavorites();
        var idx = favs.indexOf(numero);
        if (idx > -1) {
            favs.splice(idx, 1);
        } else {
            favs.push(numero);
        }
        localStorage.setItem('harpa_favoritos', JSON.stringify(favs));
        return favs.indexOf(numero) > -1;
    },
    getRecents: function () {
        try {
            var data = localStorage.getItem('harpa_recentes');
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    },
    addRecent: function (numero) {
        var recents = this.getRecents();
        var idx = recents.indexOf(numero);
        if (idx > -1) recents.splice(idx, 1);
        recents.unshift(numero);
        if (recents.length > 30) recents = recents.slice(0, 30);
        localStorage.setItem('harpa_recentes', JSON.stringify(recents));
    },
    getHymn: function (numero) {
        if (typeof HINOS_DATA !== 'undefined') {
            for (var i = 0; i < HINOS_DATA.length; i++) {
                if (HINOS_DATA[i].numero === numero) return HINOS_DATA[i];
            }
        }
        var customData = localStorage.getItem('harpa_hinos_custom');
        if (customData) {
            var customHymns = JSON.parse(customData);
            for (var j = 0; j < customHymns.length; j++) {
                if (customHymns[j].numero === numero) return customHymns[j];
            }
        }
        return null;
    },
    escapeHtml: function (text) {
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
};
