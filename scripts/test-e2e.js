/**
 * EXECUTA A SUÍTE CYPRESS DE PONTA A PONTA
 * ----------------------------------------
 * 1. Confere se a porta de testes está LIVRE (se já houver um servidor antigo
 *    rodando, os testes usariam o banco dele, que não é recriado).
 * 2. Sobe o servidor de testes (scripts/servidor-teste.js) em segundo plano.
 * 3. Espera ele responder.
 * 4. Roda o Cypress pela sua API de módulo (require("cypress").run).
 * 5. Derruba o servidor e devolve o código de saída
 *    (0 = todos passaram; 1 = houve falha).
 *
 * Uso: npm run test:e2e
 *      npm run test:e2e -- --spec cypress/e2e/api/*.cy.js   (repassa argumentos ao Cypress)
 *
 * Conceitos: child_process.spawn executa outro programa a partir do Node;
 * a API de módulo do Cypress evita chamar "npx" pelo shell (mais seguro e
 * portável entre Windows, Linux e macOS).
 */
const { spawn } = require("child_process");
const path = require("path");
const cypress = require("cypress");

const URL_TESTE = "http://localhost:3100/login.html";
const raiz = path.join(__dirname, "..");

/**
 * Indica se já existe algum servidor respondendo na URL.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function servidorRespondendo(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tenta acessar a URL até ela responder ou o tempo acabar.
 * @param {string} url
 * @param {number} limiteMs
 * @returns {Promise<void>}
 */
async function aguardarServidor(url, limiteMs = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    if (await servidorRespondendo(url)) return;
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
  throw new Error(`Servidor de testes não respondeu em ${limiteMs / 1000}s.`);
}

async function executar() {
  if (await servidorRespondendo(URL_TESTE)) {
    console.error(
      "[ERRO] Já existe um servidor na porta 3100 (provavelmente um \"npm run test:servidor\" esquecido).\n" +
      "       Encerre-o antes: os testes precisam de um banco recém-criado."
    );
    process.exit(1);
  }

  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor-teste.js")], {
    cwd: raiz,
    stdio: ["ignore", "inherit", "inherit"]
  });

  // Se o servidor cair na inicialização (ex.: banco travado), não adianta continuar.
  let servidorEncerrou = false;
  servidor.on("exit", () => { servidorEncerrou = true; });

  let codigo = 1;
  try {
    await aguardarServidor(URL_TESTE);
    if (servidorEncerrou) throw new Error("O servidor de testes encerrou durante a inicialização.");

    // Converte argumentos de linha de comando (ex.: --spec ...) em opções do Cypress.
    const opcoes = await cypress.cli.parseRunArguments(["cypress", "run", ...process.argv.slice(2)]);
    const resultado = await cypress.run(opcoes);

    // "failures" indica erro ao iniciar o Cypress; "totalFailed" conta testes que falharam.
    codigo = resultado.failures || resultado.totalFailed > 0 ? 1 : 0;
  } catch (erro) {
    console.error(`[ERRO] ${erro.message}`);
  } finally {
    servidor.kill();
  }
  process.exit(codigo);
}

executar();
