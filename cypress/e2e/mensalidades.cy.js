/**
 * E2E - MENSALIDADES E PAINEL (pela interface)
 */
import { hojeIso, formatarMoeda } from "../support/dados";

describe("Mensalidades", () => {
  beforeEach(() => {
    cy.login();
  });

  it("lança um pagamento sugerindo o valor da mensalidade do jogador", () => {
    cy.criarJogador({ valorMensalidade: "65" }).then((jogador) => {
      cy.visit("/mensalidades.html");
      cy.dataTest("btn-novo-pagamento").click();
      cy.dataTest("input-data-pagamento").should("have.value", hojeIso());
      cy.dataTest("select-jogador-pagamento").select(String(jogador.id));
      cy.dataTest("input-valor-pagamento").should("have.value", "65,00");
      cy.dataTest("select-status-pagamento").select("Pendente");
      cy.dataTest("btn-salvar-pagamento").click();

      cy.dataTest("toast").should("contain", "lançado");
      cy.dataTest("filtro-jogador").select(String(jogador.id));
      cy.dataTest("linha-pagamento").should("have.length", 1)
        .find('[data-test="status-pagamento"]').should("contain", "Pendente");
      cy.dataTest("card-total-pendente").should("contain", formatarMoeda(65));
    });
  });

  it("valida os campos do pagamento", () => {
    cy.visit("/mensalidades.html");
    cy.dataTest("btn-novo-pagamento").click();
    cy.dataTest("btn-salvar-pagamento").click();
    cy.dataTest("erro-jogador-pagamento").should("be.visible");
    cy.dataTest("erro-valor-pagamento").should("be.visible");
  });

  it("edita e cancela um pagamento (o cancelado fica no histórico, sem ações)", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-02-10", valor: "80", status: "Pendente" });
      cy.visit("/mensalidades.html");
      cy.dataTest("filtro-jogador").select(String(jogador.id));
      // ESPERA o filtro terminar: a tabela é recarregada de forma assíncrona.
      // Sem esta linha, o clique pode acontecer na lista ANTIGA (com vários pagamentos).
      cy.dataTest("linha-pagamento").should("have.length", 1);

      // Editar: Pendente → Pago
      cy.dataTest("linha-pagamento").find('[data-test="btn-editar-pagamento"]').click();
      cy.dataTest("titulo-modal-pagamento").should("contain", "Editar");
      cy.dataTest("select-status-pagamento").select("Pago");
      cy.dataTest("btn-salvar-pagamento").click();
      cy.dataTest("card-total-pago").should("contain", formatarMoeda(80));

      // Cancelar
      cy.dataTest("linha-pagamento").find('[data-test="btn-cancelar-pagamento"]').click();
      cy.dataTest("btn-confirmar").click();
      cy.dataTest("toast").should("contain", "cancelado");
      cy.dataTest("linha-pagamento").within(() => {
        cy.dataTest("status-pagamento").should("contain", "Cancelado");
        cy.dataTest("btn-editar-pagamento").should("not.exist");
      });
      cy.dataTest("card-total-pago").should("contain", formatarMoeda(0));
    });
  });

  it("combina filtros e limpa todos de uma vez", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-02-05", valor: "10", status: "Pago" });
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-03-05", valor: "20", status: "Pendente" });
      cy.visit("/mensalidades.html");

      cy.dataTest("filtro-jogador").select(String(jogador.id));
      cy.dataTest("linha-pagamento").should("have.length", 2);
      cy.dataTest("filtro-status-pagamento").select("Pendente");
      cy.dataTest("linha-pagamento").should("have.length", 1);
      cy.dataTest("filtro-mes").type("2026-02").blur(); // o "change" do input month dispara ao sair do campo
      cy.dataTest("mensagem-sem-pagamentos").should("be.visible");

      cy.dataTest("btn-limpar-filtros").click();
      cy.dataTest("filtro-jogador").should("have.value", "");
      cy.dataTest("filtro-status-pagamento").should("have.value", "");
    });
  });
});

describe("Painel", () => {
  beforeEach(() => cy.login());

  it("mostra o jogador sem lançamento e registra pelo atalho", () => {
    cy.criarJogador({ valorMensalidade: "55" }).then((jogador) => {
      cy.visit("/");
      cy.dataTest("filtro-mes-dashboard").should("have.value", hojeIso().slice(0, 7));

      cy.contains('[data-test="item-sem-lancamento"]', jogador.nomeCompleto)
        .find('[data-test="btn-registrar-pagamento"]').click();

      cy.location("pathname").should("eq", "/mensalidades.html");
      cy.dataTest("modal-pagamento").should("be.visible");
      cy.dataTest("select-jogador-pagamento").should("have.value", String(jogador.id));
      cy.dataTest("input-valor-pagamento").should("have.value", "55,00");
      cy.dataTest("btn-salvar-pagamento").click();
      cy.dataTest("toast").should("contain", "lançado");

      cy.visit("/");
      cy.contains('[data-test="item-sem-lancamento"]', jogador.nomeCompleto).should("not.exist");
    });
  });

  it("exibe gráfico de 6 meses com tabela de apoio", () => {
    cy.visit("/");
    cy.dataTest("coluna-grafico").should("have.length", 6);
    cy.dataTest("btn-ver-tabela-evolucao").click();
    cy.dataTest("tabela-evolucao").find("tbody tr").should("have.length", 6);
  });

  it("atualiza os números ao trocar o mês", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2025-08-12", valor: "123" });
      cy.visit("/");
      cy.dataTest("filtro-mes-dashboard").clear().type("2025-08").blur();
      cy.dataTest("valor-arrecadado-mes").should("contain", formatarMoeda(123));
    });
  });
});
