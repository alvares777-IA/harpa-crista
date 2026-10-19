/**
 * Etapa 2 — Monta as cifras no formato do app ([Acorde]sílaba).
 *
 * O texto do OCR é ruidoso, então a letra NÃO vem do PDF: usamos a letra
 * limpa que já está em js/hinos-data.js e tiramos do PDF apenas quais
 * acordes existem e sobre qual sílaba cada um está (pela coordenada X).
 *
 * Entrada: saida/linhas.json (etapa 1) + ../../js/hinos-data.js
 * Saída:   saida/cifras.json  e  saida/relatorio.txt
 */
import fs from "fs";
import { lerHinos } from "./hinos-data.js";

const linhasPdf = JSON.parse(fs.readFileSync("saida/linhas.json", "utf8"));
const hinos = lerHinos();

// ---------------------------------------------------------------- texto

const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = s => semAcento(s).toLowerCase().replace(/[^a-z]/g, "");

function levenshtein(a, b) {
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = v[0];
    v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = t;
    }
  }
  return v[b.length];
}

function similaridade(a, b) {
  a = normalizar(a);
  b = normalizar(b);
  if (!a.length && !b.length) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// ---------------------------------------------------------------- acordes

const ACORDE = /^[A-G](#|b)?(m|maj|dim|aug|sus|M)?\d*(\([^)]*\))?(\+|-|º|°)?(\/[A-G](#|b)?)?$/;

/** Corrige confusões comuns do OCR: 8→B, O/0→D, ~→b, c→C. */
function corrigirAcorde(t) {
  let s = t.trim().replace(/^[·.,'"`]+|[·.,'"`]+$/g, "");
  if (!s) return null;
  s = s.replace(/~/g, "b").replace(/^8/, "B").replace(/^[O0]/, "D").replace(/^c/, "C");
  s = s.replace(/\/8/, "/B").replace(/\/[O0]$/, "/D").replace(/\/c$/, "/C");
  if (s === "b") return null;
  return ACORDE.test(s) ? s : null;
}

const PEDACO_ACORDE = /[A-G8O0c](#|b|~)?(m|maj|dim|aug|sus)?\d*(\/[A-G8O0](#|b|~)?)?/g;

/**
 * O OCR às vezes junta acordes num item só ("Db Eb", "CG", "EmAO").
 * Divide em tokens, estimando o X de cada um pela posição do caractere.
 */
function tokensDeAcorde(p) {
  const larguraChar = p.w / Math.max(1, p.t.length);
  const tokens = [];
  for (const m of p.t.matchAll(/\S+/g)) {
    const t = m[0].replace(/^Ain$/, "Am");
    const x = p.x + m.index * larguraChar;
    if (corrigirAcorde(t)) { tokens.push({ t, x }); continue; }
    const pedacos = [...t.matchAll(PEDACO_ACORDE)];
    const cobre = pedacos.reduce((s, q) => s + q[0].length, 0) === t.length;
    if (pedacos.length > 1 && cobre && pedacos.every(q => corrigirAcorde(q[0]))) {
      for (const q of pedacos) tokens.push({ t: q[0], x: x + q.index * larguraChar });
    } else {
      tokens.push({ t, x });
    }
  }
  return tokens;
}

/** Linha de acordes: fonte pequena e quase todos os tokens são acordes. */
function lerLinhaAcordes(linha) {
  if (linha.h > 12.2) return null;
  const tokens = linha.palavras.flatMap(tokensDeAcorde)
    .filter(p => !/^[·.,'"`\-]+$/.test(p.t));
  if (!tokens.length) return null;
  const acordes = [];
  for (const p of tokens) {
    const c = corrigirAcorde(p.t);
    if (c) acordes.push({ acorde: c, x: p.x });
  }
  return acordes.length / tokens.length >= 0.7 ? acordes : null;
}

// ---------------------------------------------------------------- sílabas

const VOGAIS = "aeiouáéíóúâêôãõàüy";
const ehVogal = c => !!c && VOGAIS.includes(c.toLowerCase());
const ehLetra = c => !!c && /\p{L}/u.test(c);
const GRUPOS = /^(br|cr|dr|fr|gr|pr|tr|vr|bl|cl|fl|gl|pl|ch|lh|nh)$/i;

/** Índices onde começa uma sílaba (aproximação suficiente para cifra). */
function iniciosDeSilaba(texto) {
  const inicios = [];
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (!ehLetra(c)) continue;
    const ant = texto[i - 1];
    const prox = texto[i + 1];
    if (!ehLetra(ant)) { inicios.push(i); continue; }      // começo de palavra
    if (ehVogal(c)) continue;
    if (GRUPOS.test(ant + c)) continue;                      // 2ª letra de br, lh...
    if (ehVogal(prox) || GRUPOS.test(c + (prox || ""))) inicios.push(i);
  }
  return inicios;
}

// ---------------------------------------------------------------- segmentos

/**
 * Converte uma linha de letra do PDF em segmentos. O OCR leu a barra que
 * separa meio-versos como "I" (ou "1", "l", "|"); cada metade vira um
 * segmento com a posição X estimada de cada caractere.
 */
function segmentarLetra(linha) {
  const segmentos = [];
  let atual = { texto: "", xs: [] };
  for (const p of linha.palavras) {
    const t = p.t.trim();
    if (!t) continue;
    if (/^[I1l|]$/.test(t) && atual.texto) {
      segmentos.push(atual);
      atual = { texto: "", xs: [] };
      continue;
    }
    if (atual.texto) { atual.texto += " "; atual.xs.push(p.x - 1); }
    const larguraChar = p.w / t.length;
    for (let i = 0; i < t.length; i++) {
      atual.texto += t[i];
      atual.xs.push(p.x + larguraChar * i);
    }
  }
  if (atual.texto) segmentos.push(atual);
  for (let i = 0; i < segmentos.length; i++) {
    segmentos[i].xIni = i === 0 ? -Infinity : segmentos[i].xs[0] - 4;
    segmentos[i].acordes = [];
  }
  return segmentos;
}

/** Posição (índice de caractere) do acorde dentro do segmento. */
function posicaoNoSegmento(seg, x) {
  // índice contínuo: quantos caracteres o X do acorde avança
  let p = 0;
  for (let i = 0; i < seg.xs.length; i++) {
    const largura = (seg.xs[i + 1] ?? seg.xs[i] + 6) - seg.xs[i];
    if (x >= seg.xs[i]) p = i + Math.min(1, (x - seg.xs[i]) / largura);
  }
  // acorde costuma ficar no começo da sílaba ou um pouco à direita
  const inicios = iniciosDeSilaba(seg.texto);
  let melhor = inicios[0] ?? 0;
  for (const i of inicios) if (i <= p + 0.5) melhor = i;
  return melhor;
}

// ---------------------------------------------------------------- hinos

const linhasTodas = linhasPdf.flatMap(p => p.linhas.map(l => ({ ...l, pagina: p.pagina })));

const TONS = { do: "C", re: "D", mi: "E", fa: "F", sol: "G", la: "A", si: "B" };

function lerTom(texto) {
  const m = semAcento(texto).toLowerCase().match(/tom:\s*(do|re|mi|fa|sol|la|si)\s*(b|#)?\W*(maior|menor)?/);
  if (!m) return "";
  return TONS[m[1]] + (m[2] || "") + (m[3] === "menor" ? "m" : "");
}

const raiz = acorde => (acorde.match(/^[A-G](#|b)?/) || [""])[0];

const ehLinhaDeLetra = l => l.h >= 10 && l.h <= 15 && !lerLinhaAcordes(l);

/** Encontra a linha de cabeçalho de cada hino, em ordem. */
function localizarCabecalhos() {
  const cabecalhos = new Map();
  let inicio = 0;
  for (const hino of hinos) {
    const n = hino.numero;
    for (let i = inicio; i < Math.min(linhasTodas.length, inicio + 400); i++) {
      const l = linhasTodas[i];
      if (l.h < 14) continue;
      const m = l.texto.match(/^\W*(\d{1,3})\W+(.*)$/);
      const numero = m ? +m[1] : null;
      const titulo = (m ? m[2] : l.texto).replace(/\s*Tom:.*$/, "");
      const letras = titulo.replace(/[^\p{L}]/gu, "");
      const maiusculas = letras.length >= 2 &&
        letras.replace(/[^\p{Lu}]/gu, "").length / letras.length >= 0.75;
      const sim = similaridade(titulo, hino.titulo);
      if ((numero === n && maiusculas && sim >= 0.3) || (maiusculas && sim >= 0.75)) {
        cabecalhos.set(n, i);
        inicio = i + 1;
        break;
      }
    }
  }

  // Segunda passada: cabeçalho ilegível no OCR → procura a 1ª linha da letra
  // entre os hinos vizinhos já localizados.
  for (const hino of hinos) {
    const n = hino.numero;
    if (cabecalhos.has(n) || !hino.letra?.versos?.length) continue;
    const anteriores = [...cabecalhos].filter(([k]) => k < n).map(([, v]) => v);
    const posteriores = [...cabecalhos].filter(([k]) => k > n).map(([, v]) => v);
    const de = anteriores.length ? Math.max(...anteriores) + 1 : 0;
    const ate = posteriores.length ? Math.min(...posteriores) : linhasTodas.length;
    const [l1, l2 = ""] = hino.letra.versos[0].texto.split("\n");
    let melhor = -1, melhorSim = 0.6;
    for (let i = de; i < ate; i++) {
      if (!ehLinhaDeLetra(linhasTodas[i])) continue;
      const texto = linhasTodas[i].texto.replace(/\s[I1l|]\s/g, " ");
      const sim = Math.max(similaridade(texto, l1), similaridade(texto, `${l1} ${l2}`));
      if (sim > melhorSim) { melhor = i; melhorSim = sim; }
    }
    if (melhor >= 0) cabecalhos.set(n, Math.max(de, melhor - 3));
  }
  return cabecalhos;
}

/**
 * Linhas de letra do bloco de um hino, já divididas em meio-versos e com os
 * acordes da linha de cima (quando houver) posicionados por caractere.
 */
function lerSegmentos(ini, fim) {
  const segmentos = [];
  for (let i = ini; i < fim; i++) {
    const linha = linhasTodas[i];
    if (!ehLinhaDeLetra(linha)) continue;
    const segs = segmentarLetra(linha);
    const acordes = i > ini ? lerLinhaAcordes(linhasTodas[i - 1]) : null;
    for (const a of acordes || []) {
      let alvo = segs[0];
      for (const s of segs) if (a.x >= s.xIni) alvo = s;
      alvo.acordes.push({ acorde: a.acorde, pos: posicaoNoSegmento(alvo, a.x) });
    }
    segmentos.push(...segs);
  }
  return segmentos;
}

const paraAlinhar = s => semAcento(s).toLowerCase().replace(/[^a-z]/g, " ");

/**
 * Alinhamento global (Needleman-Wunsch) entre o texto do OCR e a letra
 * limpa. Devolve, para cada índice do OCR, o índice na letra limpa e se
 * aquele caractere bateu exatamente.
 */
function alinhar(ocr, limpo) {
  const a = paraAlinhar(ocr), b = paraAlinhar(limpo);
  const n = a.length, m = b.length;
  const dir = new Uint8Array((n + 1) * (m + 1)); // 1 diagonal, 2 cima, 3 esquerda
  let ant = new Int32Array(m + 1).map((_, j) => j);
  let atual = new Int32Array(m + 1);
  for (let j = 1; j <= m; j++) dir[j] = 3;
  for (let i = 1; i <= n; i++) {
    atual[0] = i;
    dir[i * (m + 1)] = 2;
    for (let j = 1; j <= m; j++) {
      const diag = ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      const cima = ant[j] + 1;
      const esq = atual[j - 1] + 1;
      // em empate prefere "esquerda": empurra o OCR para o início da letra
      let v = esq, d = 3;
      if (diag < v) { v = diag; d = 1; }
      if (cima < v) { v = cima; d = 2; }
      atual[j] = v;
      dir[i * (m + 1) + j] = d;
    }
    [ant, atual] = [atual, ant];
  }
  const mapa = new Int32Array(n).fill(-1);
  const exato = new Uint8Array(n);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const d = dir[i * (m + 1) + j];
    if (d === 1) {
      mapa[i - 1] = j - 1;
      exato[i - 1] = a[i - 1] === b[j - 1] && a[i - 1] !== " " ? 1 : 0;
      i--; j--;
    } else if (d === 2) i--;
    else j--;
  }
  let prox = m - 1;
  for (let k = n - 1; k >= 0; k--) {
    if (mapa[k] === -1) mapa[k] = prox; else prox = mapa[k];
  }
  return { mapa, exato };
}

/** Insere [acordes] numa linha, a partir de um Map posição → acordes. */
function escreverLinha(texto, porPos) {
  let saida = "";
  for (let i = 0; i < texto.length; i++) {
    for (const c of porPos.get(i) || []) saida += `[${c}]`;
    saida += texto[i];
  }
  return saida;
}

function silabaMaisProxima(texto, pos) {
  const inicios = iniciosDeSilaba(texto);
  return inicios.reduce((m, i) => (Math.abs(i - pos) < Math.abs(m - pos) ? i : m), inicios[0] ?? 0);
}

function montarHino(hino, ini, fim) {
  const bloco = linhasTodas.slice(ini, fim);

  // Tom: vale o rótulo "Tom:", salvo quando o primeiro e o último acorde
  // concordam entre si e discordam dele (OCR leu o rótulo errado).
  const rotulo = lerTom(bloco.slice(0, 5).map(l => l.texto).join(" "));
  const acordesBloco = bloco.map(lerLinhaAcordes).filter(Boolean).flat().map(a => a.acorde);
  const comoTom = c => (c ? raiz(c) + (/^[A-G](#|b)?m(?!aj)/.test(c) ? "m" : "") : "");
  const primeiro = comoTom(acordesBloco[0]);
  const ultimo = comoTom(acordesBloco.at(-1));
  const tom = !rotulo || (primeiro === ultimo && raiz(primeiro) !== raiz(rotulo))
    ? primeiro || rotulo
    : rotulo;

  // Letra limpa do app, linha a linha
  const linhas = [];
  hino.letra.versos.forEach((v, e) =>
    v.texto.split("\n").forEach(t => linhas.push({ estrofe: e, texto: t, acordes: new Map() })));
  const limpo = linhas.map(l => l.texto).join("\n");
  const inicioLinha = [];
  linhas.reduce((off, l) => { inicioLinha.push(off); return off + l.texto.length + 1; }, 0);

  // Só segmentos que se parecem com alguma linha (ou par de linhas) da letra
  const candidatas = linhas.flatMap((l, i) => [l.texto, `${l.texto} ${linhas[i + 1]?.texto || ""}`]);
  const segmentos = lerSegmentos(ini, fim).filter(s =>
    candidatas.some(c => similaridade(s.texto, c) >= 0.5));

  const ocr = segmentos.map(s => s.texto).join(" ");
  const { mapa, exato } = alinhar(ocr, limpo);

  let off = 0;
  for (const s of segmentos) {
    for (const a of s.acordes) {
      const g = off + a.pos;
      // descarta acorde cuja vizinhança não alinhou bem
      let bons = 0, total = 0;
      for (let k = Math.max(off, g - 5); k < Math.min(off + s.texto.length, g + 6); k++) {
        total++;
        bons += exato[k] || (ocr[k] === " " ? 1 : 0);
      }
      if (!total || bons / total < 0.6) continue;
      let p = mapa[g];
      let li = inicioLinha.findLastIndex(o => o <= p);
      if (p - inicioLinha[li] >= linhas[li].texto.length && li + 1 < linhas.length) {
        li++;
        p = inicioLinha[li];
      }
      const linha = linhas[li];
      const pos = silabaMaisProxima(linha.texto, p - inicioLinha[li]);
      linha.acordes.set(pos, [...(linha.acordes.get(pos) || []), a.acorde]);
    }
    off += s.texto.length + 1;
  }

  // Estrofes sem acorde: copia da 1ª estrofe cifrada de mesma métrica,
  // sílaba por sílaba (os hinos são estróficos).
  const estrofes = hino.letra.versos.map((v, e) => linhas.filter(l => l.estrofe === e));
  const ehCoro = e => hino.letra.versos[e].tipo === "coro";
  const modelo = estrofes.find((ls, e) => !ehCoro(e) && ls.some(l => l.acordes.size));
  let copiadas = 0;
  estrofes.forEach((ls, e) => {
    if (!modelo || ls === modelo || ehCoro(e)) return;
    if (ls.some(l => l.acordes.size) || ls.length !== modelo.length) return;
    copiadas++;
    ls.forEach((l, i) => {
      const origem = modelo[i];
      const silOrig = iniciosDeSilaba(origem.texto);
      const silDest = iniciosDeSilaba(l.texto);
      for (const [pos, acs] of origem.acordes) {
        const k = Math.max(0, silOrig.indexOf(pos));
        const destino = silDest[Math.min(k, silDest.length - 1)] ?? 0;
        l.acordes.set(destino, [...(l.acordes.get(destino) || []), ...acs]);
      }
    });
  });

  const comAcorde = linhas.filter(l => l.acordes.size).length;
  const texto = estrofes.map((ls, e) =>
    (ehCoro(e) ? "Coro:\n" : "") +
    ls.map(l => escreverLinha(l.texto, l.acordes)).join("\n")).join("\n\n");

  return {
    numero: hino.numero,
    titulo: hino.titulo,
    tom,
    tomRotulo: rotulo,
    pagina: linhasTodas[ini].pagina,
    estrofesCopiadas: copiadas,
    cobertura: linhas.length ? comAcorde / linhas.length : 0,
    cifras: (tom ? `Tom: ${tom}\n\n` : "") + texto,
  };
}

// ---------------------------------------------------------------- main

const cabecalhos = localizarCabecalhos();
const ordenados = [...cabecalhos.entries()].sort((a, b) => a[1] - b[1]);
const resultado = [];
for (let i = 0; i < ordenados.length; i++) {
  const [numero, ini] = ordenados[i];
  const fim = ordenados[i + 1]?.[1] ?? linhasTodas.length;
  const hino = hinos.find(h => h.numero === numero);
  if (!hino.letra?.versos?.length) continue;
  resultado.push(montarHino(hino, ini, fim));
}
resultado.sort((a, b) => a.numero - b.numero);

fs.writeFileSync("saida/cifras.json", JSON.stringify(resultado, null, 2));

const naoEncontrados = hinos.filter(h => !cabecalhos.has(h.numero)).map(h => h.numero);
const fracos = resultado.filter(r => r.cobertura < 0.6);
const tomDivergente = resultado.filter(r => r.tomRotulo && r.tom !== r.tomRotulo);
const media = resultado.reduce((s, r) => s + r.cobertura, 0) / resultado.length;
const relatorio = [
  `Hinos localizados no PDF: ${cabecalhos.size}/${hinos.length}`,
  `Cifras montadas: ${resultado.length}`,
  `Cobertura média (linhas com acorde): ${(media * 100).toFixed(1)}%`,
  `Hinos com estrofes copiadas da 1ª estrofe: ${resultado.filter(r => r.estrofesCopiadas).length}`,
  `Tom do rótulo trocado pelo acorde final: ${tomDivergente.length}`,
  `Sem tom identificado: ${resultado.filter(r => !r.tom).map(r => r.numero).join(", ") || "nenhum"}`,
  "",
  `Não localizados (${naoEncontrados.length}): ${naoEncontrados.join(", ")}`,
  "",
  `Cobertura abaixo de 60% (${fracos.length}):`,
  ...fracos.map(r => `  ${r.numero} ${r.titulo} — ${(r.cobertura * 100).toFixed(0)}% (pág. ${r.pagina})`),
  "",
  "Tom divergente (rótulo → usado):",
  ...tomDivergente.map(r => `  ${r.numero} ${r.titulo}: ${r.tomRotulo} → ${r.tom}`),
].join("\n");
fs.writeFileSync("saida/relatorio.txt", relatorio + "\n");
console.log(relatorio.split("\n").slice(0, 9).join("\n"));
