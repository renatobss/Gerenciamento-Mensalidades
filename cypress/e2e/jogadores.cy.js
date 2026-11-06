/**
 * E2E - CADASTRO DE JOGADORES (pela interface)
 */
import { gerarCpf, formatarCpf, sufixoUnico, formatarMoeda } from "../support/dados";

describe("Jogadores", () => {
  beforeEach(() => {
    cy.login();
    cy.visit("/jogadores.html");
  });

  it("aplica as máscaras de CPF, telefone e valor", () => {
    cy.dataTest("btn-novo-jogador").click();
    cy.dataTest("input-cpf").type("52998224725").should("have.value", "529.982.247-25");
    cy.dataTest("input-telefone").type("11987654321").should("have.value", "(11) 98765-4321");
    cy.dataTest("input-valor-mensalidade").type("80.5").should("have.value", "80,5");
  });

  it("valida campos obrigatórios e CPF inválido", () => {
    cy.dataTest("btn-novo-jogador").click();
    cy.dataTest("input-data-entrada").clear();
    cy.dataTest("input-cpf").type("12345678900");
    cy.dataTest("btn-salvar-jogador").click();

    cy.dataTest("erro-nome-jogador").should("be.visible");
    cy.dataTest("erro-cpf").should("contain", "CPF inválido");
    cy.dataTest("erro-data-entrada").should("be.visible");
    cy.dataTest("erro-valor-mensalidade").should("be.visible");
  });

  it("cadastra um jogador completo", () => {
    const nome = `Jogador Cypress ${sufixoUnico()}`;
    const cpf = gerarCpf();

    cy.dataTest("btn-novo-jogador").click();
    cy.dataTest("input-nome-jogador").type(nome);
    cy.dataTest("input-cpf").type(cpf);
    cy.dataTest("input-telefone").type("11987654321");
    cy.dataTest("input-data-nascimento").type("1990-03-15");
    cy.dataTest("input-data-entrada").clear().type("2026-01-10");
    cy.dataTest("input-valor-mensalidade").type("90");
    cy.dataTest("select-status-jogador").select("ativo");
    cy.dataTest("input-observacoes").type("Goleiro");
    cy.dataTest("btn-salvar-jogador").click();

    cy.dataTest("toast").should("contain", "cadastrado");
    cy.dataTest("input-pesquisa-jogador").type(nome);
    cy.contains('[data-test="linha-jogador"]', nome)
      .should("contain", formatarCpf(cpf))
      .and("contain", formatarMoeda(90));
  });

  it("mostra o erro de CPF duplicado vindo do backend", () => {
    cy.criarJogador().then((existente) => {
      cy.dataTest("btn-novo-jogador").click();
      cy.dataTest("input-nome-jogador").type(`Outro ${sufixoUnico()}`);
      cy.dataTest("input-cpf").type(existente.cpf);
      cy.dataTest("input-valor-mensalidade").type("50");
      cy.dataTest("btn-salvar-jogador").click();
      cy.dataTest("mensagem-erro-formulario-jogador").should("contain", "CPF");
    });
  });

  it("edita um jogador e mostra os campos formatados", () => {
    cy.criarJogador({ valorMensalidade: "75" }).then((jogador) => {
      cy.dataTest("input-pesquisa-jogador").type(jogador.nomeCompleto);
      cy.contains('[data-test="linha-jogador"]', jogador.nomeCompleto).find('[data-test="btn-editar-jogador"]').click();

      cy.dataTest("input-cpf").should("have.value", formatarCpf(jogador.cpf));
      cy.dataTest("input-valor-mensalidade").should("have.value", "75,00").clear().type("95");
      cy.dataTest("btn-salvar-jogador").click();

      cy.dataTest("toast").should("contain", "atualizado");
      cy.contains('[data-test="linha-jogador"]', jogador.nomeCompleto).should("contain", formatarMoeda(95));
    });
  });

  it("inativa um jogador e o encontra no filtro de inativos", () => {
    cy.criarJogador().then((jogador) => {
      cy.dataTest("input-pesquisa-jogador").type(jogador.nomeCompleto);
      cy.contains('[data-test="linha-jogador"]', jogador.nomeCompleto).find('[data-test="btn-inativar-jogador"]').click();
      cy.dataTest("btn-confirmar").click();

      cy.dataTest("toast").should("contain", "inativado");
      cy.dataTest("mensagem-sem-jogadores").should("be.visible"); // sumiu dos ativos
      cy.dataTest("filtro-status-jogador").select("inativo");
      cy.contains('[data-test="linha-jogador"]', jogador.nomeCompleto)
        .find('[data-test="status-jogador"]').should("contain", "Inativo");
    });
  });

  it("pesquisa pelo CPF", () => {
    cy.criarJogador().then((jogador) => {
      cy.dataTest("input-pesquisa-jogador").type(formatarCpf(jogador.cpf).slice(0, 7));
      cy.contains('[data-test="linha-jogador"]', jogador.nomeCompleto).should("exist");
    });
  });
});
