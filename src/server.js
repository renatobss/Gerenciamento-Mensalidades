/**
 * PONTO DE ENTRADA DO SERVIDOR
 * ----------------------------
 * Executado por "npm start" ou "npm run dev".
 * Responsabilidades:
 *   1. Ler as configurações (.env), sempre PRIMEIRO, antes de qualquer outro módulo.
 *   2. Preparar os dados (migrar senhas, criar o admin inicial).
 *   3. Só então colocar o app para "escutar" requisições na porta.
 *
 * A porta vem do .env (PORT) ou usa 3001.
 */
const { porta } = require("./config/ambiente");
const app = require("./app");
const { inicializarDados } = require("./config/inicializarDados");

/**
 * Função principal. É "async" para podermos usar "await" na inicialização:
 * o servidor só abre a porta depois que os dados estão prontos.
 */
async function iniciar() {
  await inicializarDados();

  app.listen(porta, () => {
    console.log(`Servidor rodando em http://localhost:${porta}`);
  });
}

iniciar().catch((erro) => {
  // Se a inicialização falhar, não faz sentido subir o servidor pela metade.
  console.error("[ERRO FATAL] Falha ao iniciar o servidor:", erro);
  process.exit(1);
});
