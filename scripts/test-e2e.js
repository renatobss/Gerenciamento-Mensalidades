/**
 * EXECUTA A SUÍTE CYPRESS DE PONTA A PONTA
 * ----------------------------------------
 * 1. Sobe o servidor de testes (scripts/servidor-teste.js) em segundo plano.
 * 2. Espera ele responder.
 * 3. Roda "cypress run" (modo sem janela, ideal para CI).
 * 4. Derruba o servidor e devolve o código de saída do Cypress
 *    (0 = todos passaram; diferente de 0 = houve falha).
 *
 * Uso: npm run test:e2e
 *      npm run test:e2e -- --spec cypress/e2e/api/*.cy.js   (repassa argumentos ao Cypress)
 *
 * Conceito: child_process.spawn executa outro programa a partir do Node.
 */
const { spawn } = require("child_process");
const path = require("path");

const URL_TESTE = "http://localhost:3100/login.html";
const raiz = path.join(__dirname, "..");

/**
 * Tenta acessar a URL até ela responder ou o tempo acabar.
 * @param {string} url
 * @param {number} limiteMs
 * @returns {Promise<void>}
 */
async function aguardarServidor(url, limiteMs = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    try {
      const resposta = await fetch(url);
      if (resposta.ok) return;
    } catch {
      // servidor ainda subindo: tenta de novo
    }
    await new Promise((resolver) => setTimeout(resolver, 300));
  }
  throw new Error(`Servidor de testes não respondeu em ${limiteMs / 1000}s.`);
}

async function executar() {
  const servidor = spawn(process.execPath, [path.join(__dirname, "servidor-teste.js")], {
    cwd: raiz,
    stdio: ["ignore", "inherit", "inherit"]
  });

  let codigo = 1;
  try {
    await aguardarServidor(URL_TESTE);
    // shell: true é necessário no Windows para executar "npx".
    const argumentosExtras = process.argv.slice(2);
    const cypress = spawn("npx", ["cypress", "run", ...argumentosExtras], { cwd: raiz, stdio: "inherit", shell: true });
    codigo = await new Promise((resolver) => cypress.on("close", resolver));
  } catch (erro) {
    console.error(erro.message);
  } finally {
    servidor.kill();
  }
  process.exit(codigo);
}

executar();
