/**
 * E2E - TELA DE LOGIN
 * -------------------
 * Aqui o login é feito PELA TELA, porque é ela que está sendo testada.
 * Nas outras specs usamos cy.login() (pela API), que é mais rápido.
 */
describe("Login", () => {
  beforeEach(() => {
    cy.visit("/login.html");
  });

  it("valida os campos obrigatórios", () => {
    cy.dataTest("btn-login").click();
    cy.dataTest("erro-usuario").should("be.visible").and("contain", "Informe o usuário");
    cy.dataTest("erro-senha").should("be.visible").and("contain", "Informe a senha");
    cy.dataTest("usuario").should("have.attr", "aria-invalid", "true");
  });

  it("limpa o erro do campo ao digitar", () => {
    cy.dataTest("btn-login").click();
    cy.dataTest("usuario").type("a");
    cy.dataTest("erro-usuario").should("not.be.visible");
  });

  it("mostra e oculta a senha", () => {
    cy.dataTest("senha").type("minhaSenha1").should("have.attr", "type", "password");
    cy.dataTest("btn-visualizar-senha").click().should("have.attr", "aria-pressed", "true");
    cy.dataTest("senha").should("have.attr", "type", "text");
    cy.dataTest("btn-visualizar-senha").click();
    cy.dataTest("senha").should("have.attr", "type", "password");
  });

  it("exibe mensagem amigável para credenciais inválidas e limpa a senha", () => {
    cy.dataTest("usuario").type("admin");
    cy.dataTest("senha").type("senha-errada");
    cy.dataTest("btn-login").click();
    cy.dataTest("mensagem-erro-login").should("be.visible").and("contain", "Usuário ou senha incorretos");
    cy.dataTest("senha").should("have.value", "");
  });

  it("mostra o estado de carregamento durante a autenticação", () => {
    // cy.intercept atrasa a resposta para conseguirmos ver o botão "carregando".
    cy.intercept("POST", "/api/login", (requisicao) => {
      requisicao.on("response", (resposta) => resposta.setDelay(800));
    }).as("login");

    cy.dataTest("usuario").type(Cypress.expose("adminUsuario"));
    cy.dataTest("senha").type(Cypress.expose("adminSenha"));
    cy.dataTest("btn-login").click();
    cy.dataTest("btn-login").should("be.disabled").and("contain", "Entrando");
    cy.wait("@login");
  });

  it("entra no sistema com credenciais válidas", () => {
    cy.dataTest("usuario").type(Cypress.expose("adminUsuario"));
    cy.dataTest("senha").type(Cypress.expose("adminSenha"), { log: false }); // log: false não mostra a senha no painel
    cy.dataTest("btn-login").click();
    cy.location("pathname").should("eq", "/");
    cy.dataTest("usuario-logado").should("contain", "Administrador");
  });

  it("avisa quando a sessão expirou", () => {
    cy.visit("/login.html?sessao=expirada");
    cy.dataTest("mensagem-info-login").should("be.visible").and("contain", "sessão expirou");
  });

  it("não permite abrir páginas internas sem login", () => {
    cy.visit("/mensalidades.html");
    cy.location("pathname").should("eq", "/login.html");
  });

  it("sai do sistema pelo menu", () => {
    cy.login();
    cy.visit("/");
    cy.dataTest("btn-sair").click();
    cy.location("pathname").should("eq", "/login.html");
    cy.visit("/");
    cy.location("pathname").should("eq", "/login.html");
  });
});
