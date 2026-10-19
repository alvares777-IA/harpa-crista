/**
 * Etapa 1 — Lê o PDF e salva todas as linhas de texto com posições.
 *
 * O PDF é um scan com camada de OCR. Agrupamos os itens de texto por
 * coordenada Y para reconstruir as linhas e guardamos o X e a largura de
 * cada palavra — é isso que permite saber em qual sílaba cai cada acorde.
 *
 * Entrada: harpa-crista.pdf
 * Saída:   saida/linhas.json
 */
import fs from "fs";
import { PDFParse } from "pdf-parse";

const PDF = "harpa-crista.pdf";
const SAIDA = "saida/linhas.json";

// Distância máxima em Y para considerar dois itens na mesma linha
const TOLERANCIA_Y = 3;

function agruparLinhas(itens) {
  const linhas = [];
  for (const it of itens) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let linha = linhas.find(l => Math.abs(l.y - y) <= TOLERANCIA_Y);
    if (!linha) {
      linha = { y, palavras: [] };
      linhas.push(linha);
    }
    linha.palavras.push({
      t: it.str,
      x: +x.toFixed(1),
      w: +it.width.toFixed(1),
      h: +it.height.toFixed(1),
    });
  }
  linhas.sort((a, b) => b.y - a.y);
  for (const l of linhas) {
    l.palavras.sort((a, b) => a.x - b.x);
    l.y = +l.y.toFixed(1);
    l.h = Math.max(...l.palavras.map(p => p.h));
    l.texto = l.palavras.map(p => p.t).join(" ");
  }
  return linhas;
}

async function main() {
  const parser = new PDFParse({ data: fs.readFileSync(PDF) });
  const doc = await parser.load();
  const paginas = [];

  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    paginas.push({ pagina: n, linhas: agruparLinhas(tc.items) });
    page.cleanup();
    if (n % 50 === 0) console.log(`  página ${n}/${doc.numPages}`);
  }
  await parser.destroy();

  fs.mkdirSync("saida", { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(paginas));
  console.log(`${paginas.length} páginas salvas em ${SAIDA}`);
}

// pdfjs pode deixar o event loop vazio enquanto aguarda o worker;
// este timer mantém o processo vivo até terminar.
const manterVivo = setInterval(() => {}, 1000);
main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => clearInterval(manterVivo));
