/**
 * COMANDOS CUSTOMIZADOS DO CYPRESS
 * --------------------------------
 * Cypress.Commands.add cria comandos novos, usados como os nativos:
 *   cy.login()
 *   cy.criarJogador().then((jogador) => { ... })
 *
 * Boa prática: preparar dados pela API (rápido e estável) e usar a TELA só
 * para o que está sendo testado. Ex.: para testar a edição de um jogador,
 * criamos o jogador via API e editamos pela interface.
 */
import { novoJogador, novoUsuario } from "./dados";

/**
 * Faz login pela API e guarda a sessão em cache.
 *
 * cy.session: na primeira chamada executa o login e salva os cookies;
 * nas próximas, só restaura os cookies (muito mais rápido que logar pela tela).
 * "validate" confere se a sessão ainda vale; se não valer, refaz o login.
 *
 * @param {string} [usuario] - padrão: admin (cypress.config.js)
 * @param {string} [senha]
 */
Cypress.Commands.add("login", (usuario = Cypress.expose("adminUsuario"), senha = Cypress.expose("adminSenha")) => {
  cy.session(
    ["login", usuario],
    () => {
      cy.request("POST", "/api/login", { usuario, senha }).its("status").should("eq", 200);
    },
    {
      validate() {
        cy.request("/api/sessao").its("status").should("eq", 200);
      }
    }
  );
});

/**
 * Cria um jogador pela API (requer estar logado).
 * @param {object} [dados] - Campos para sobrescrever o jogador padrão.
 * @returns {Cypress.Chainable<object>} O jogador criado (resposta da API).
 */
Cypress.Commands.add("criarJogador", (dados = {}) => {
  return cy.request("POST", "/api/jogadores", novoJogador(dados)).then((resposta) => {
    expect(resposta.status).to.eq(201);
    return resposta.body;
  });
});

/**
 * Cria um usuário pela API (requer estar logado como admin).
 * Devolve o usuário criado + a senha usada (a API nunca devolve a senha).
 * @param {object} [dados]
 * @returns {Cypress.Chainable<object>}
 */
Cypress.Commands.add("criarUsuario", (dados = {}) => {
  const usuario = novoUsuario(dados);
  return cy.request("POST", "/api/usuarios", usuario).then((resposta) => {
    expect(resposta.status).to.eq(201);
    return { ...resposta.body, senha: usuario.senha };
  });
});

/**
 * Lança um pagamento pela API.
 * @param {object} dados - { jogador_id, data_pagamento, valor, status }
 * @returns {Cypress.Chainable<object>}
 */
Cypress.Commands.add("criarPagamento", (dados) => {
  return cy.request("POST", "/api/pagamentos", { status: "Pago", ...dados }).then((resposta) => {
    expect(resposta.status).to.eq(201);
    return resposta.body;
  });
});

/**
 * Atalho: cy.dataTest("btn-login") === cy.get('[data-test="btn-login"]')
 * @param {string} valor
 */
Cypress.Commands.add("dataTest", (valor) => cy.get(`[data-test="${valor}"]`));
