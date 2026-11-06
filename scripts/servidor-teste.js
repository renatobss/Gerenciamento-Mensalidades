/**
 * SERVIDOR PARA TESTES AUTOMATIZADOS
 * ----------------------------------
 * Sobe a aplicação com um BANCO DESCARTÁVEL (data/teste-e2e.db), recriado do
 * zero a cada execução. Os testes nunca tocam nos dados reais.
 *
 * Por que um arquivo .js em vez de variáveis no package.json?
 * No Windows, "DB_PATH=x node ..." não funciona no cmd/PowerShell. Definir as
 * variáveis aqui dentro funciona em qualquer sistema, sem instalar o "cross-env".
 *
 * Uso: npm run test:servidor   (porta 3100)
 */
const fs = require("fs");
const path = require("path");

const bancoTeste = path.join(__dirname, "..", "data", "teste-e2e.db");

// As variáveis precisam ser definidas ANTES de carregar o servidor,
// porque src/config/ambiente.js lê process.env no momento em que é carregado.
process.env.DB_PATH = bancoTeste;
process.env.PORT = process.env.PORT_TESTE || "3100";
process.env.SESSION_SECRET = "segredo-apenas-para-testes";
process.env.ADMIN_SENHA_INICIAL = "admin123";
// Limite alto: os testes de "senha errada" não podem bloquear o admin.
process.env.LOGIN_MAX_TENTATIVAS = "1000";

// Banco novo a cada execução: os testes começam sempre do mesmo estado
// (apenas o usuário admin). Os arquivos -wal/-shm são auxiliares do SQLite.
for (const arquivo of [bancoTeste, `${bancoTeste}-wal`, `${bancoTeste}-shm`]) {
  fs.rmSync(arquivo, { force: true });
}

console.log(`[TESTE] Banco descartável: ${bancoTeste}`);
require("../src/server");
