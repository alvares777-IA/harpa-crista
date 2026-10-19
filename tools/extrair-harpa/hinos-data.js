/**
 * Leitura e gravação de js/hinos-data.js preservando o restante do arquivo
 * (comentário de cabeçalho e código depois do array).
 */
import fs from "fs";

export const ARQUIVO = new URL("../../js/hinos-data.js", import.meta.url);

const MARCA = "var HINOS_DATA = ";

function partes() {
  const src = fs.readFileSync(ARQUIVO, "utf8");
  const ini = src.indexOf(MARCA) + MARCA.length;
  const fim = src.indexOf("\n];", ini) + 2;
  return { antes: src.slice(0, ini), json: src.slice(ini, fim), depois: src.slice(fim) };
}

export function lerHinos() {
  return JSON.parse(partes().json);
}

export function gravarHinos(hinos) {
  const { antes, depois } = partes();
  fs.writeFileSync(ARQUIVO, antes + JSON.stringify(hinos, null, 4) + depois);
}
