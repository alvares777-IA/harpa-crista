/**
 * Sobe a versão do app antes de publicar.
 *
 * O servidor de produção (openresty) guarda JS/CSS/imagens em cache por até
 * um dia. Trocar o "?v=N" nos HTML faz o navegador pedir uma URL nova, e o
 * VERSION do sw.js faz o service worker se atualizar e limpar o cache antigo.
 *
 * Uso (na raiz do projeto):  node tools/atualizar-versao.js
 */
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const ler = f => fs.readFileSync(path.join(raiz, f), "utf8");
const gravar = (f, s) => fs.writeFileSync(path.join(raiz, f), s);

const atual = +ler("sw.js").match(/var VERSION = '(\d+)'/)[1];
const nova = atual + 1;

gravar("sw.js", ler("sw.js").replace(/var VERSION = '\d+'/, `var VERSION = '${nova}'`));

for (const html of fs.readdirSync(raiz).filter(f => f.endsWith(".html"))) {
  gravar(html, ler(html).replace(/(\.(?:js|css|png|svg|json))\?v=\d+/g, `$1?v=${nova}`));
}

console.log(`Versão ${atual} → ${nova}`);
