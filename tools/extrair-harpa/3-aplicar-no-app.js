/**
 * Etapa 3 — Grava as cifras montadas em js/hinos-data.js.
 *
 * Por padrão só preenche hinos que ainda estão com o aviso "Em breve";
 * cifras já existentes no app são mantidas. Use --sobrescrever para
 * substituir todas pelas do PDF.
 *
 * Entrada: saida/cifras.json (etapa 2)
 */
import fs from "fs";
import { lerHinos, gravarHinos } from "./hinos-data.js";

const sobrescrever = process.argv.includes("--sobrescrever");
const cifras = new Map(
  JSON.parse(fs.readFileSync("saida/cifras.json", "utf8")).map(c => [c.numero, c]));

// Mesmos avisos que js/hino-detail.js trata como "sem cifra"
const semCifra = h => !h.cifras ||
  /as cifras deste hino estarão disponíveis|Cifra disponível em breve/.test(h.cifras);

const hinos = lerHinos();
let aplicadas = 0, mantidas = 0;
for (const hino of hinos) {
  const nova = cifras.get(hino.numero);
  if (!nova) continue;
  if (!sobrescrever && !semCifra(hino)) { mantidas++; continue; }
  hino.cifras = nova.cifras;
  aplicadas++;
}
gravarHinos(hinos);

console.log(`Cifras aplicadas: ${aplicadas}`);
console.log(`Cifras existentes mantidas: ${mantidas}`);
console.log(`Hinos ainda sem cifra: ${hinos.filter(semCifra).length}`);
