/**
 * CONFIGURAÇÃO DO CYPRESS
 * -----------------------
 * baseUrl: endereço do servidor de TESTES (npm run test:servidor), que usa um
 * banco descartável. Assim, cy.visit("/jogadores.html") abre
 * http://localhost:3100/jogadores.html.
 *
 * expose: valores acessíveis nos testes com Cypress.expose("chave").
 */
const { defineConfig } = require("cypress");

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://localhost:3100",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    viewportWidth: 1280,
    viewportHeight: 800,
    video: false,
    // Em "cypress run", tenta de novo uma vez antes de considerar falha (reduz falsos negativos).
    retries: { runMode: 1, openMode: 0 }
  },
  /**
   * Valores públicos lidos nos testes com Cypress.expose("chave").
   * (No Cypress 16, Cypress.env() foi removido: "expose" é para valores NÃO
   * sensíveis; segredos de verdade usariam cy.env() e variáveis CYPRESS_*.)
   * Esta senha é só do banco descartável de testes (scripts/servidor-teste.js).
   */
  expose: {
    adminUsuario: "admin",
    adminSenha: "admin123"
  }
});
