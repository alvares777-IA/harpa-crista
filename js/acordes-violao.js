/**
 * HARPA CRISTÃ - Diagramas de acordes para violão
 * Interpreta o nome do acorde, escolhe posições no braço e desenha em SVG.
 *
 * Cordas sempre da 6ª (Mi grave) para a 1ª (Mi agudo).
 * Em "casas", -1 = corda abafada (X) e 0 = corda solta (O).
 */
var AcordesViolao = (function () {
    'use strict';

    var AFINACAO = [40, 45, 50, 55, 59, 64]; // MIDI: E2 A2 D3 G3 B3 E4
    var NOTAS_SUSTENIDO = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    var NOTAS_BEMOL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    var NATURAIS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    // Intervalos (em semitons) de cada tipo de acorde
    var TIPOS = {
        '': [0, 4, 7], 'M': [0, 4, 7],
        'm': [0, 3, 7], '-': [0, 3, 7], 'mi': [0, 3, 7], 'min': [0, 3, 7],
        '7': [0, 4, 7, 10],
        'm7': [0, 3, 7, 10], '-7': [0, 3, 7, 10],
        'maj7': [0, 4, 7, 11], '7M': [0, 4, 7, 11], 'M7': [0, 4, 7, 11],
        '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9],
        '9': [0, 4, 7, 10, 2], 'add9': [0, 4, 7, 2],
        'dim': [0, 3, 6, 9], 'º': [0, 3, 6, 9], '°': [0, 3, 6, 9], 'o': [0, 3, 6, 9],
        'm7b5': [0, 3, 6, 10], 'ø': [0, 3, 6, 10],
        '+': [0, 4, 8], 'aug': [0, 4, 8], '5+': [0, 4, 8],
        '4': [0, 5, 7], 'sus4': [0, 5, 7], 'sus': [0, 5, 7],
        '7(4)': [0, 5, 7, 10], '74': [0, 5, 7, 10], '7sus4': [0, 5, 7, 10],
        '2': [0, 2, 7], 'sus2': [0, 2, 7]
    };

    // Formas abertas clássicas (preferidas quando existem)
    var ABERTOS = {
        'C': [-1, 3, 2, 0, 1, 0], 'D': [-1, -1, 0, 2, 3, 2], 'E': [0, 2, 2, 1, 0, 0],
        'G': [3, 2, 0, 0, 0, 3], 'A': [-1, 0, 2, 2, 2, 0],
        'Am': [-1, 0, 2, 2, 1, 0], 'Dm': [-1, -1, 0, 2, 3, 1], 'Em': [0, 2, 2, 0, 0, 0],
        'C7': [-1, 3, 2, 3, 1, 0], 'D7': [-1, -1, 0, 2, 1, 2], 'E7': [0, 2, 0, 1, 0, 0],
        'G7': [3, 2, 0, 0, 0, 1], 'A7': [-1, 0, 2, 0, 2, 0], 'B7': [-1, 2, 1, 2, 0, 2],
        'Am7': [-1, 0, 2, 0, 1, 0], 'Em7': [0, 2, 0, 0, 0, 0], 'Dm7': [-1, -1, 0, 2, 1, 1],
        'D/F#': [2, -1, 0, 2, 3, 2], 'G/B': [-1, 2, 0, 0, 3, 3], 'C/E': [0, 3, 2, 0, 1, 0],
        'C/G': [3, 3, 2, 0, 1, 0], 'A/E': [0, 0, 2, 2, 2, 0], 'D/A': [-1, 0, 0, 2, 3, 2],
        'F/A': [-1, 0, 3, 2, 1, 1], 'F/C': [-1, 3, 3, 2, 1, 1], 'G/D': [-1, -1, 0, 0, 0, 3],
        'A/C#': [-1, 4, 2, 2, 2, 0], 'E/G#': [4, -1, 2, 1, 0, 0]
    };

    // Pestanas móveis: formato de Mi (tônica na 6ª corda) e de Lá (na 5ª)
    var PESTANA_MI = {
        '': [0, 2, 2, 1, 0, 0], 'm': [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0],
        'm7': [0, 2, 0, 0, 0, 0], '4': [0, 2, 2, 2, 0, 0]
    };
    var PESTANA_LA = {
        '': [-1, 0, 2, 2, 2, 0], 'm': [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0],
        'm7': [-1, 0, 2, 0, 1, 0], '4': [-1, 0, 2, 2, 3, 0], 'maj7': [-1, 0, 2, 1, 2, 0]
    };
    var SINONIMOS = { 'M': '', '-': 'm', 'mi': 'm', 'min': 'm', '-7': 'm7', 'sus4': '4', 'sus': '4', '7M': 'maj7', 'M7': 'maj7' };

    function notaParaClasse(letra, acidente) {
        var pc = NATURAIS[letra];
        if (acidente === '#') pc += 1;
        if (acidente === 'b') pc -= 1;
        return (pc + 12) % 12;
    }

    /** "Bb/F" → { raiz: 10, tipo: '', intervalos: [...], baixo: 5, ... } */
    function interpretar(nome) {
        var m = String(nome).trim().match(/^([A-G])(#|b)?(.*?)(?:\/([A-G])(#|b)?)?$/);
        if (!m || !TIPOS.hasOwnProperty(m[3])) return null;
        var raiz = notaParaClasse(m[1], m[2]);
        var tipo = SINONIMOS.hasOwnProperty(m[3]) ? SINONIMOS[m[3]] : m[3];
        var usaBemol = m[2] === 'b' || m[5] === 'b' || (m[1] === 'F' && !m[2]);
        return {
            nome: nome,
            letra: m[1],
            nomeBaixo: m[4] ? m[4] + (m[5] || '') : null,
            raiz: raiz,
            tipo: tipo,
            intervalos: TIPOS[m[3]],
            baixo: m[4] ? notaParaClasse(m[4], m[5]) : raiz,
            invertido: !!m[4],
            nomes: usaBemol ? NOTAS_BEMOL : NOTAS_SUSTENIDO
        };
    }

    function notasDoAcorde(ac) {
        return ac.intervalos.map(function (i) { return (ac.raiz + i) % 12; });
    }

    // ----- análise de uma posição -----

    /** Calcula pestana, dedos e se a posição é tocável. */
    function analisar(casas) {
        var presas = [];
        casas.forEach(function (c, i) { if (c > 0) presas.push({ corda: i, casa: c }); });
        if (!presas.length) return { valida: true, dedos: 0, pestana: null };
        var menor = Math.min.apply(null, presas.map(function (p) { return p.casa; }));
        if (presas.length <= 4) return { valida: true, dedos: presas.length, pestana: null };

        // Mais de 4 notas presas: só com pestana na menor casa
        var inicio = -1;
        for (var i = 0; i < 6; i++) if (casas[i] === menor) { inicio = i; break; }
        for (var j = inicio; j < 6; j++) {
            if (casas[j] === 0) return { valida: false };
        }
        var acima = presas.filter(function (p) { return p.casa > menor; }).length;
        if (acima > 3) return { valida: false };
        return { valida: true, dedos: acima + 1, pestana: { casa: menor, de: inicio } };
    }

    function montar(casas) {
        var a = analisar(casas);
        if (!a.valida) return null;
        return { casas: casas, pestana: a.pestana, dedos: a.dedos };
    }

    function transpor(forma, deslocamento) {
        return forma.map(function (c) { return c < 0 ? c : c + deslocamento; });
    }

    // ----- busca genérica -----

    /**
     * Procura posições em janelas de 4 casas. Exige todas as notas do acorde
     * (a quinta pode faltar em acordes de 4+ notas), o baixo correto na corda
     * mais grave tocada e no máximo 4 dedos (contando pestana como 1).
     */
    function buscar(ac) {
        var notas = notasDoAcorde(ac);
        var obrigatorias = notas.filter(function (n, i) {
            return !(notas.length >= 4 && ac.intervalos[i] === 7);
        });
        if (ac.invertido && notas.indexOf(ac.baixo) < 0) notas.push(ac.baixo);

        var encontradas = {};
        var lista = [];

        for (var inicio = 1; inicio <= 10; inicio++) {
            var opcoes = AFINACAO.map(function (solta) {
                var ops = [-1];
                if (notas.indexOf(solta % 12) >= 0) ops.push(0);
                for (var c = inicio; c < inicio + 4; c++) {
                    if (notas.indexOf((solta + c) % 12) >= 0) ops.push(c);
                }
                return ops;
            });
            percorrer(opcoes, 0, [], function (casas) {
                var chave = casas.join(',');
                if (encontradas[chave]) return;
                var nota = avaliar(ac, casas, obrigatorias);
                if (nota === null) return;
                encontradas[chave] = true;
                var v = montar(casas.slice());
                if (v) { v.nota = nota; lista.push(v); }
            });
        }
        lista.sort(function (a, b) { return a.nota - b.nota; });
        return lista;
    }

    function percorrer(opcoes, i, atual, cb) {
        if (i === opcoes.length) { cb(atual); return; }
        for (var k = 0; k < opcoes[i].length; k++) {
            atual.push(opcoes[i][k]);
            percorrer(opcoes, i + 1, atual, cb);
            atual.pop();
        }
    }

    /** Pontuação (menor é melhor) ou null se a posição não serve. */
    function avaliar(ac, casas, obrigatorias) {
        var tocadas = [];
        casas.forEach(function (c, i) { if (c >= 0) tocadas.push(i); });
        if (tocadas.length < 4) return null;

        var primeira = tocadas[0];
        if ((AFINACAO[primeira] + casas[primeira]) % 12 !== ac.baixo) return null;

        var abafadasNoMeio = 0;
        for (var i = primeira; i < 6; i++) if (casas[i] < 0) abafadasNoMeio++;
        if (abafadasNoMeio > 1) return null;

        var soam = {};
        tocadas.forEach(function (i) { soam[(AFINACAO[i] + casas[i]) % 12] = true; });
        for (var k = 0; k < obrigatorias.length; k++) if (!soam[obrigatorias[k]]) return null;

        var presas = casas.filter(function (c) { return c > 0; });
        var menor = presas.length ? Math.min.apply(null, presas) : 0;
        var maior = presas.length ? Math.max.apply(null, presas) : 0;
        if (maior - menor > 3) return null;

        var a = analisar(casas);
        if (!a.valida) return null;

        var soltas = casas.filter(function (c) { return c === 0; }).length;
        return menor +
            (6 - tocadas.length) * 1.5 +
            abafadasNoMeio * 3 +
            (a.pestana ? 1.5 : 0) +
            a.dedos * 0.3 -
            soltas * 0.3 +
            (maior - menor) * 0.5;
    }

    // ----- API -----

    /** Lista de posições para o acorde, da mais comum para a menos comum. */
    function posicoes(nome) {
        var ac = interpretar(nome);
        if (!ac) return [];
        var lista = [];
        var vistas = {};
        function adicionar(casas) {
            var chave = casas.join(',');
            if (vistas[chave]) return;
            var v = montar(casas);
            if (v) { vistas[chave] = true; lista.push(v); }
        }

        var chaveAberto = ac.nomes[ac.raiz] + ac.tipo + (ac.invertido ? '/' + ac.nomes[ac.baixo] : '');
        var aberto = ABERTOS[chaveAberto] ||
            ABERTOS[NOTAS_SUSTENIDO[ac.raiz] + ac.tipo + (ac.invertido ? '/' + NOTAS_SUSTENIDO[ac.baixo] : '')];
        if (aberto) adicionar(aberto);

        if (!ac.invertido) {
            var pestanas = [];
            var casaMi = (ac.raiz - 4 + 12) % 12;
            var casaLa = (ac.raiz - 9 + 12) % 12;
            if (PESTANA_MI[ac.tipo] && casaMi > 0) pestanas.push(transpor(PESTANA_MI[ac.tipo], casaMi));
            if (PESTANA_LA[ac.tipo] && casaLa > 0) pestanas.push(transpor(PESTANA_LA[ac.tipo], casaLa));
            pestanas.sort(function (a, b) {
                return Math.max.apply(null, a) - Math.max.apply(null, b);
            });
            pestanas.forEach(adicionar);
        }

        buscar(ac).forEach(function (v) { if (lista.length < 4) adicionar(v.casas); });
        return lista.slice(0, 4);
    }

    // Grau (em letras) de cada intervalo: terça → +2 letras, quinta → +4...
    var LETRAS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    var GRAU = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6 };

    /** Grafia pela função da nota no acorde (Cm = C Eb G, e não C D# G). */
    function grafar(ac, intervalo) {
        var alvo = (ac.raiz + intervalo) % 12;
        var letra = LETRAS[(LETRAS.indexOf(ac.letra) + GRAU[intervalo]) % 7];
        var dif = (alvo - NATURAIS[letra] + 12) % 12;
        if (dif === 0) return letra;
        if (dif === 1) return letra + '#';
        if (dif === 11) return letra + 'b';
        return ac.nomes[alvo];
    }

    /** Nomes das notas do acorde, ex.: ["C", "E", "G"] (+ baixo se invertido). */
    function notas(nome) {
        var ac = interpretar(nome);
        if (!ac) return [];
        var lista = ac.intervalos.map(function (i) { return grafar(ac, i); });
        if (ac.invertido && notasDoAcorde(ac).indexOf(ac.baixo) < 0) lista.push(ac.nomeBaixo);
        return lista;
    }

    /** Desenha o diagrama da posição como SVG (string). */
    function desenhar(posicao) {
        var casas = posicao.casas;
        var presas = casas.filter(function (c) { return c > 0; });
        var maior = presas.length ? Math.max.apply(null, presas) : 0;
        var menor = presas.length ? Math.min.apply(null, presas) : 0;
        var base = maior <= 5 ? 1 : menor;
        var LINHAS = 5, X0 = 34, Y0 = 34, DX = 24, DY = 30;
        var largura = X0 * 2 + DX * 5, altura = Y0 + DY * LINHAS + 22;
        var s = [];

        s.push('<svg class="cv-diagrama" viewBox="0 0 ' + largura + ' ' + altura + '" role="img" aria-hidden="true">');

        // Casas (linhas horizontais) e pestana do braço (nut)
        for (var k = 0; k <= LINHAS; k++) {
            var y = Y0 + k * DY;
            var classe = (k === 0 && base === 1) ? 'cv-nut' : 'cv-traste';
            s.push('<line class="' + classe + '" x1="' + X0 + '" y1="' + y + '" x2="' + (X0 + DX * 5) + '" y2="' + y + '"/>');
        }
        // Cordas (linhas verticais)
        for (var i = 0; i < 6; i++) {
            var x = X0 + i * DX;
            s.push('<line class="cv-corda" x1="' + x + '" y1="' + Y0 + '" x2="' + x + '" y2="' + (Y0 + DY * LINHAS) + '"/>');
        }
        if (base > 1) {
            s.push('<text class="cv-casa" x="' + (X0 - 10) + '" y="' + (Y0 + DY / 2 + 5) + '" text-anchor="end">' + base + 'ª</text>');
        }

        // Pestana
        if (posicao.pestana) {
            var py = Y0 + (posicao.pestana.casa - base + 0.5) * DY;
            var px1 = X0 + posicao.pestana.de * DX;
            s.push('<rect class="cv-pestana" x="' + (px1 - 9) + '" y="' + (py - 9) + '" width="' + (X0 + DX * 5 - px1 + 18) +
                '" height="18" rx="9"/>');
        }

        // X / O e bolinhas
        casas.forEach(function (c, i) {
            var x = X0 + i * DX;
            if (c < 0) {
                s.push('<text class="cv-marca" x="' + x + '" y="' + (Y0 - 10) + '" text-anchor="middle">×</text>');
            } else if (c === 0) {
                s.push('<circle class="cv-solta" cx="' + x + '" cy="' + (Y0 - 14) + '" r="6"/>');
            } else if (!(posicao.pestana && c === posicao.pestana.casa && i >= posicao.pestana.de)) {
                var y = Y0 + (c - base + 0.5) * DY;
                s.push('<circle class="cv-dedo" cx="' + x + '" cy="' + y + '" r="9"/>');
            }
        });

        // Nome das cordas embaixo
        ['E', 'A', 'D', 'G', 'B', 'E'].forEach(function (n, i) {
            s.push('<text class="cv-nome-corda" x="' + (X0 + i * DX) + '" y="' + (altura - 4) + '" text-anchor="middle">' + n + '</text>');
        });

        s.push('</svg>');
        return s.join('');
    }

    return {
        interpretar: interpretar,
        posicoes: posicoes,
        notas: notas,
        desenhar: desenhar
    };
})();

if (typeof module !== 'undefined') module.exports = AcordesViolao;
