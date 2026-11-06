/**
 * E2E - CADASTRO DE USUÁRIOS (pela interface)
 */
import { novoUsuario } from "../support/dados";

describe("Usuários", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/usuarios.html");
  });

  /**
   * Preenche o formulário do modal. Função comum do JavaScript, reaproveitada
   * pelos testes deste arquivo.
   * @param {object} dados
   */
  function preencherFormulario(dados) {
    cy.dataTest("input-nome").clear().type(dados.nomeCompleto);
    cy.dataTest("input-email").clear().type(dados.email);
    cy.dataTest("input-usuario").clear().type(dados.usuario);
    if (dados.senha) cy.dataTest("input-senha").type(dados.senha, { log: false });
    if (dados.confirmarSenha) cy.dataTest("input-confirmar-senha").type(dados.confirmarSenha, { log: false });
    cy.dataTest("select-perfil").select(dados.perfil);
  }

  it("valida os campos obrigatórios no formulário", () => {
    cy.dataTest("btn-novo-usuario").click();
    cy.dataTest("modal-usuario").should("be.visible");
    cy.dataTest("btn-salvar-usuario").click();
    ["erro-nome", "erro-email", "erro-usuario", "erro-senha", "erro-perfil"].forEach((erro) => {
      cy.dataTest(erro).should("be.visible");
    });
  });

  it("valida a confirmação de senha", () => {
    cy.dataTest("btn-novo-usuario").click();
    preencherFormulario(novoUsuario({ confirmarSenha: "diferente1" }));
    cy.dataTest("btn-salvar-usuario").click();
    cy.dataTest("erro-confirmar-senha").should("contain", "não confere");
  });

  it("cadastra um usuário comum", () => {
    const dados = novoUsuario();
    cy.dataTest("btn-novo-usuario").click();
    preencherFormulario(dados);
    cy.dataTest("btn-salvar-usuario").click();

    cy.dataTest("toast").should("contain", "cadastrado");
    cy.dataTest("modal-usuario").should("not.be.visible");
    cy.dataTest("input-pesquisa-usuario").type(dados.usuario);
    cy.contains('[data-test="linha-usuario"]', dados.usuario).within(() => {
      cy.dataTest("perfil-usuario").should("contain", "Usuário comum");
      cy.dataTest("status-usuario").should("contain", "Ativo");
    });
  });

  it("mostra o erro de duplicidade vindo do backend", () => {
    cy.criarUsuario().then((existente) => {
      cy.dataTest("btn-novo-usuario").click();
      preencherFormulario(novoUsuario({ email: existente.email }));
      cy.dataTest("btn-salvar-usuario").click();
      cy.dataTest("mensagem-erro-formulario-usuario").should("be.visible").and("contain", "e-mail já está cadastrado");
    });
  });

  it("edita um usuário existente", () => {
    cy.criarUsuario().then((usuario) => {
      cy.dataTest("input-pesquisa-usuario").type(usuario.usuario);
      cy.contains('[data-test="linha-usuario"]', usuario.usuario).find('[data-test="btn-editar-usuario"]').click();

      cy.dataTest("titulo-modal-usuario").should("contain", "Editar");
      cy.dataTest("input-email").should("have.value", usuario.email);
      cy.dataTest("input-nome").clear().type("Nome Editado Cypress");
      cy.dataTest("select-perfil").select("admin");
      cy.dataTest("btn-salvar-usuario").click();

      cy.dataTest("toast").should("contain", "atualizado");
      cy.contains('[data-test="linha-usuario"]', usuario.usuario)
        .should("contain", "Nome Editado Cypress")
        .find('[data-test="perfil-usuario"]').should("contain", "Administrador");
    });
  });

  it("inativa um usuário após confirmação", () => {
    cy.criarUsuario().then((usuario) => {
      cy.dataTest("input-pesquisa-usuario").type(usuario.usuario);
      cy.contains('[data-test="linha-usuario"]', usuario.usuario).find('[data-test="btn-inativar-usuario"]').click();
      cy.dataTest("modal-confirmacao").should("be.visible");
      cy.dataTest("btn-confirmar").click();

      cy.dataTest("toast").should("contain", "inativado");
      cy.dataTest("filtro-status-usuario").select("inativo");
      cy.contains('[data-test="linha-usuario"]', usuario.usuario)
        .find('[data-test="status-usuario"]').should("contain", "Inativo");
    });
  });

  it("não oferece inativar o próprio usuário logado", () => {
    cy.contains('[data-test="linha-usuario"]', "admin").find('[data-test="btn-inativar-usuario"]').should("not.exist");
  });

  it("usuário comum não vê o menu nem a página de usuários", () => {
    cy.criarUsuario({ perfil: "comum" }).then((comum) => {
      cy.login(comum.usuario, comum.senha);
      cy.visit("/");
      cy.dataTest("menu-jogadores").should("be.visible");
      cy.dataTest("menu-usuarios").should("not.exist");

      cy.visit("/usuarios.html");
      cy.location("pathname").should("eq", "/"); // redirecionado pelo backend
    });
  });
});
