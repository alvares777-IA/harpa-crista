# extrair-harpa

Ferramenta que extrai as cifras da **Harpa Cristã Cifrada** (CPAD, 2ª ed. 2008) em PDF
e grava no campo `cifras` de [`js/hinos-data.js`](../../js/hinos-data.js), no formato
usado pelo app: `[Acorde]sílaba`.

Não faz parte do app publicado. Só precisa rodar de novo se o PDF ou a letra dos hinos mudarem.

## Como usar

O PDF não vai para o git (tem 126 MB e é material da CPAD). Coloque-o nesta pasta com o
nome `harpa-crista.pdf`.

```bash
cd tools/extrair-harpa
npm install
npm run tudo        # ou cada etapa separada:
npm run extrair     # 1. PDF → saida/linhas.json
npm run montar      # 2. linhas → saida/cifras.json + saida/relatorio.txt
npm run aplicar     # 3. cifras → js/hinos-data.js
```

Por padrão a etapa 3 só preenche hinos que ainda mostram o aviso "Em breve, as cifras…".
As cifras que já existem no app são mantidas. Para substituir todas pelas do PDF, use
`node 3-aplicar-no-app.js --sobrescrever`.

## Como funciona

O PDF é um scan com camada de OCR, por isso o texto vem com ruído. A estratégia é:

1. **Extrair linhas com posição.** Os itens de texto do PDF são agrupados por coordenada Y,
   e o X e a largura de cada palavra são guardados.
2. **Separar acordes e letra.** Cada hino tem um cabeçalho (`7 CRISTO CURA, SIM!`), uma linha
   `Tom:` e, em seguida, linhas de acordes (fonte pequena) alternadas com linhas de letra.
   Depois vem a partitura, que no OCR vira lixo e é descartada.
3. **Usar a letra limpa do app.** A letra não é tirada do PDF. O texto do OCR é alinhado
   caractere a caractere com a letra que já está em `hinos-data.js`. Assim, cada acorde vai
   para a sílaba certa da letra limpa, e não para o texto com erro de OCR.
4. **Repetir a cifra nas estrofes.** Quando o PDF só cifra a 1ª estrofe, os acordes são
   repetidos sílaba por sílaba nas demais estrofes de mesma métrica.

Correções de OCR aplicadas aos acordes: `8→B`, `O/0→D`, `~→b`, `c→C`, `Ain→Am`, além da
separação de acordes grudados (`DbEb`, `CG`).

## Limitações

- O tom usado é o do rótulo `Tom:`, a menos que o primeiro e o último acorde concordem entre
  si e discordem dele. Os casos trocados aparecem em `saida/relatorio.txt`.
- Trechos com melisma (`gló-ó-ó-ória`) às vezes ficam sem acorde.
- O relatório lista os hinos com menos de 60% das linhas cifradas, para revisão manual.
