/**
 * PONTO DE ENTRADA DO SERVIDOR
 * ----------------------------
 * Executado por "npm start" ou "npm run dev".
 * Responsabilidade única: pegar o app configurado (src/app.js) e colocá-lo
 * para "escutar" requisições em uma porta.
 *
 * process.env.PORT permite trocar a porta sem mudar o código.
 * Exemplo (PowerShell): $env:PORT=4000; npm start
 */
const app = require("./app");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
