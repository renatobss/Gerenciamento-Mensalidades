/**
 * TESTES DE API - AUTENTICAÇÃO
 * ----------------------------
 * cy.request faz requisições HTTP direto, sem abrir a tela.
 * failOnStatusCode: false → não falha automaticamente em 4xx/5xx, para que
 * possamos verificar justamente os cenários de erro.
 */
describe("API - Autenticação", () => {
  const admin = { usuario: Cypress.expose("adminUsuario"), senha: Cypress.expose("adminSenha") };

  it("faz login com usuário e senha válidos e não expõe a senha", () => {
    cy.request("POST", "/api/login", admin).then((resposta) => {
      expect(resposta.status).to.eq(200);
      expect(resposta.body.usuario).to.include({ usuario: "admin", perfil: "admin", ativo: true });
      // Segurança: a resposta nunca pode conter a senha ou o hash.
      expect(JSON.stringify(resposta.body)).not.to.match(/senha|scrypt/i);
    });
  });

  it("aceita o login sem diferenciar maiúsculas", () => {
    cy.request("POST", "/api/login", { ...admin, usuario: "ADMIN" }).its("status").should("eq", 200);
  });

  it("recusa credenciais inválidas com 401 e mensagem genérica", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { usuario: "admin", senha: "senha-errada" },
      failOnStatusCode: false
    }).then((resposta) => {
      expect(resposta.status).to.eq(401);
      expect(resposta.body.erros[0]).to.eq("Usuario ou senha invalidos.");
    });
  });

  it("devolve 401 também para usuário inexistente (não revela quais usuários existem)", () => {
    cy.request({
      method: "POST",
      url: "/api/login",
      body: { usuario: "nao.existe", senha: "qualquer1" },
      failOnStatusCode: false
    }).its("status").should("eq", 401);
  });

  // Cenários de entrada inválida: o mesmo teste para vários corpos (data-driven).
  [
    { descricao: "corpo vazio", corpo: {} },
    { descricao: "usuário em branco", corpo: { usuario: "   ", senha: "x" } },
    { descricao: "senha não textual", corpo: { usuario: "admin", senha: 123 } }
  ].forEach(({ descricao, corpo }) => {
    it(`recusa ${descricao} com 400`, () => {
      cy.request({ method: "POST", url: "/api/login", body: corpo, failOnStatusCode: false })
        .its("status").should("eq", 400);
    });
  });

  it("protege a API: sem sessão devolve 401", () => {
    cy.clearCookies();
    ["/api/pagamentos", "/api/jogadores", "/api/usuarios", "/api/dashboard", "/api/sessao"].forEach((url) => {
      cy.request({ url, failOnStatusCode: false }).its("status").should("eq", 401);
    });
  });

  it("redireciona páginas internas para o login quando não há sessão", () => {
    cy.clearCookies();
    cy.request({ url: "/jogadores.html", followRedirect: false }).then((resposta) => {
      expect(resposta.status).to.eq(302);
      expect(resposta.redirectedToUrl).to.match(/\/login\.html$/);
    });
  });

  it("encerra a sessão no logout", () => {
    cy.request("POST", "/api/login", admin);
    cy.request("/api/sessao").its("status").should("eq", 200);
    cy.request("/api/logout");
    cy.request({ url: "/api/sessao", failOnStatusCode: false }).its("status").should("eq", 401);
  });
});
