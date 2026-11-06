/**
 * TESTES DE API - USUÁRIOS E PERMISSÕES
 */
import { novoUsuario, sufixoUnico } from "../../support/dados";

describe("API - Usuários", () => {
  beforeEach(() => {
    cy.login(); // admin
  });

  it("cadastra usuário e nunca devolve a senha", () => {
    const dados = novoUsuario();
    cy.request("POST", "/api/usuarios", dados).then((resposta) => {
      expect(resposta.status).to.eq(201);
      expect(resposta.body).to.include({ usuario: dados.usuario, email: dados.email, perfil: "comum", ativo: true });
      expect(resposta.body).not.to.have.any.keys("senha", "confirmarSenha");
    });
  });

  it("valida campos obrigatórios e força da senha (400)", () => {
    cy.request({
      method: "POST",
      url: "/api/usuarios",
      body: { nomeCompleto: "Jo", email: "invalido", usuario: "a b", senha: "123", confirmarSenha: "123", perfil: "chefe" },
      failOnStatusCode: false
    }).then((resposta) => {
      expect(resposta.status).to.eq(400);
      expect(resposta.body.erros).to.have.length.of.at.least(4);
    });
  });

  it("recusa confirmação de senha diferente", () => {
    cy.request({
      method: "POST",
      url: "/api/usuarios",
      body: novoUsuario({ confirmarSenha: "outra123" }),
      failOnStatusCode: false
    }).then((resposta) => {
      expect(resposta.status).to.eq(400);
      expect(resposta.body.erros).to.include("A confirmação de senha não confere.");
    });
  });

  it("impede e-mail e nome de usuário duplicados, mesmo com maiúsculas (409)", () => {
    cy.criarUsuario().then((existente) => {
      cy.request({
        method: "POST",
        url: "/api/usuarios",
        body: novoUsuario({ email: existente.email.toUpperCase(), usuario: existente.usuario.toUpperCase() }),
        failOnStatusCode: false
      }).then((resposta) => {
        expect(resposta.status).to.eq(409);
        expect(resposta.body.erros).to.have.length(2);
      });
    });
  });

  it("pesquisa por nome e filtra por situação", () => {
    const marcador = sufixoUnico();
    cy.criarUsuario({ nomeCompleto: `Pesquisa ${marcador}` });
    cy.request(`/api/usuarios?busca=${marcador}&status=ativo`).then((resposta) => {
      expect(resposta.body.total).to.eq(1);
      expect(resposta.body.itens[0].nomeCompleto).to.eq(`Pesquisa ${marcador}`);
    });
  });

  it("edita sem informar senha e mantém a senha atual", () => {
    cy.criarUsuario().then((usuario) => {
      cy.request("PUT", `/api/usuarios/${usuario.id}`, {
        nomeCompleto: "Nome Alterado",
        email: usuario.email,
        usuario: usuario.usuario,
        perfil: "comum",
        ativo: "ativo"
      }).its("body.nomeCompleto").should("eq", "Nome Alterado");

      // A senha antiga continua funcionando.
      cy.request("POST", "/api/login", { usuario: usuario.usuario, senha: usuario.senha }).its("status").should("eq", 200);
    });
  });

  it("impede o administrador de inativar a si mesmo", () => {
    cy.request("/api/sessao").then(({ body }) => {
      cy.request({ method: "PATCH", url: `/api/usuarios/${body.usuario.id}/inativar`, failOnStatusCode: false })
        .its("status").should("eq", 400);
    });
  });

  it("usuário inativado perde a sessão e não consegue entrar (403)", () => {
    cy.criarUsuario().then((usuario) => {
      // Sessão separada do usuário comum.
      cy.request("POST", "/api/login", { usuario: usuario.usuario, senha: usuario.senha });
      cy.getCookie("connect.sid").then((cookieComum) => {
        // Volta a ser admin para inativar.
        cy.clearCookies();
        cy.request("POST", "/api/login", { usuario: "admin", senha: "admin123" });
        cy.request("PATCH", `/api/usuarios/${usuario.id}/inativar`).its("body.ativo").should("eq", false);

        // O cookie antigo do usuário inativado deixa de valer.
        cy.clearCookies();
        cy.setCookie("connect.sid", cookieComum.value);
        cy.request({ url: "/api/sessao", failOnStatusCode: false }).its("status").should("eq", 401);

        cy.request({
          method: "POST",
          url: "/api/login",
          body: { usuario: usuario.usuario, senha: usuario.senha },
          failOnStatusCode: false
        }).its("status").should("eq", 403);
      });
    });
  });

  describe("Permissões do perfil comum", () => {
    it("recebe 403 em toda a API de usuários", () => {
      cy.criarUsuario({ perfil: "comum" }).then((comum) => {
        cy.clearCookies();
        cy.request("POST", "/api/login", { usuario: comum.usuario, senha: comum.senha });

        cy.request({ url: "/api/usuarios", failOnStatusCode: false }).its("status").should("eq", 403);
        cy.request({ method: "POST", url: "/api/usuarios", body: novoUsuario(), failOnStatusCode: false })
          .its("status").should("eq", 403);
        // ...mas acessa jogadores e pagamentos normalmente.
        cy.request("/api/jogadores").its("status").should("eq", 200);
        cy.request("/api/pagamentos").its("status").should("eq", 200);
      });
    });
  });
});
