/**
 * TESTES DE API - JOGADORES E PAGAMENTOS
 */
import { novoJogador, gerarCpf, formatarCpf } from "../../support/dados";

describe("API - Jogadores", () => {
  beforeEach(() => cy.login());

  it("cadastra jogador normalizando CPF, telefone e valor", () => {
    const cpf = gerarCpf();
    cy.request("POST", "/api/jogadores", novoJogador({
      cpf: formatarCpf(cpf),
      telefone: "(11) 98765-4321",
      valorMensalidade: "1.234,56"
    })).then((resposta) => {
      expect(resposta.status).to.eq(201);
      expect(resposta.body.cpf).to.eq(cpf); // guardado só com dígitos
      expect(resposta.body.telefone).to.eq("11987654321");
      expect(resposta.body.valorMensalidade).to.eq(1234.56);
    });
  });

  [
    { campo: "CPF inválido", dados: { cpf: "123.456.789-00" }, mensagem: "CPF inválido." },
    { campo: "CPF com dígitos iguais", dados: { cpf: "111.111.111-11" }, mensagem: "CPF inválido." },
    { campo: "nascimento no futuro", dados: { dataNascimento: "2099-01-01" }, mensagem: "A data de nascimento não pode ser no futuro." },
    { campo: "data inexistente", dados: { dataEntrada: "2026-02-31" }, mensagem: "Informe uma data de entrada no grupo válida." },
    { campo: "mensalidade zero", dados: { valorMensalidade: "0" }, mensagem: "Informe um valor de mensalidade maior que zero." }
  ].forEach(({ campo, dados, mensagem }) => {
    it(`recusa ${campo} (400)`, () => {
      cy.request({ method: "POST", url: "/api/jogadores", body: novoJogador(dados), failOnStatusCode: false })
        .then((resposta) => {
          expect(resposta.status).to.eq(400);
          expect(resposta.body.erros).to.include(mensagem);
        });
    });
  });

  it("impede CPF duplicado (409)", () => {
    cy.criarJogador().then((jogador) => {
      cy.request({ method: "POST", url: "/api/jogadores", body: novoJogador({ cpf: jogador.cpf }), failOnStatusCode: false })
        .its("status").should("eq", 409);
    });
  });

  it("impede mesmo nome com mesma data de nascimento (409)", () => {
    cy.criarJogador({ cpf: "" }).then((jogador) => {
      cy.request({
        method: "POST",
        url: "/api/jogadores",
        body: novoJogador({ cpf: "", nomeCompleto: jogador.nomeCompleto.toUpperCase(), dataNascimento: jogador.dataNascimento }),
        failOnStatusCode: false
      }).its("status").should("eq", 409);
    });
  });

  it("pesquisa por parte do CPF", () => {
    cy.criarJogador().then((jogador) => {
      cy.request(`/api/jogadores?busca=${jogador.cpf.slice(0, 6)}&status=todos`)
        .its("body.itens").should((itens) => {
          expect(itens.map((item) => item.id)).to.include(jogador.id);
        });
    });
  });

  it("não lista jogador inativo nas opções do formulário de pagamento", () => {
    cy.criarJogador().then((jogador) => {
      cy.request("PATCH", `/api/jogadores/${jogador.id}/inativar`);
      cy.request("/api/jogadores/opcoes").its("body").should((opcoes) => {
        expect(opcoes.map((opcao) => opcao.id)).not.to.include(jogador.id);
      });
      cy.request("/api/jogadores/opcoes?incluirInativos=1").its("body").should((opcoes) => {
        expect(opcoes.map((opcao) => opcao.id)).to.include(jogador.id);
      });
    });
  });
});

describe("API - Pagamentos", () => {
  beforeEach(() => cy.login());

  it("exige um jogador cadastrado (400 sem jogador, 404 inexistente)", () => {
    cy.request({ method: "POST", url: "/api/pagamentos", body: { data_pagamento: "2026-03-10", valor: "50" }, failOnStatusCode: false })
      .its("status").should("eq", 400);
    cy.request({ method: "POST", url: "/api/pagamentos", body: { jogador_id: 999999, data_pagamento: "2026-03-10", valor: "50" }, failOnStatusCode: false })
      .its("status").should("eq", 404);
  });

  it("bloqueia novo pagamento para jogador inativo, mas permite editar o histórico", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-03-10", valor: "80" }).then((pagamento) => {
        cy.request("PATCH", `/api/jogadores/${jogador.id}/inativar`);

        cy.request({
          method: "POST",
          url: "/api/pagamentos",
          body: { jogador_id: jogador.id, data_pagamento: "2026-04-10", valor: "80" },
          failOnStatusCode: false
        }).its("status").should("eq", 400);

        cy.request("PUT", `/api/pagamentos/${pagamento.id}`, {
          jogador_id: jogador.id, data_pagamento: "2026-03-10", valor: "85", status: "Pago"
        }).its("body.valor").should("eq", 85);
      });
    });
  });

  it("cancela (exclusão lógica): mantém o registro, tira dos totais e bloqueia edição", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-03-15", valor: "70", status: "Pendente" }).then((pagamento) => {
        cy.request(`/api/pagamentos?jogador_id=${jogador.id}`).its("body.totalPendente").should("eq", 70);

        cy.request("PATCH", `/api/pagamentos/${pagamento.id}/cancelar`).its("body.status").should("eq", "Cancelado");

        cy.request(`/api/pagamentos?jogador_id=${jogador.id}`).then(({ body }) => {
          expect(body.total).to.eq(1);           // continua no histórico
          expect(body.totalPendente).to.eq(0);   // não entra nos totais
        });

        cy.request({
          method: "PUT",
          url: `/api/pagamentos/${pagamento.id}`,
          body: { jogador_id: jogador.id, data_pagamento: "2026-03-15", valor: "70", status: "Pago" },
          failOnStatusCode: false
        }).its("status").should("eq", 400);
      });
    });
  });

  it("DELETE apenas cancela (compatibilidade com a versão anterior)", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-03-20", valor: "40" }).then((pagamento) => {
        cy.request("DELETE", `/api/pagamentos/${pagamento.id}`).its("status").should("eq", 204);
        cy.request(`/api/pagamentos?jogador_id=${jogador.id}&status=Cancelado`).its("body.total").should("eq", 1);
      });
    });
  });

  it("filtra por jogador e status, com paginação e totais do filtro inteiro", () => {
    cy.criarJogador().then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-01-10", valor: "10" });
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-02-10", valor: "20" });
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: "2026-03-10", valor: "30", status: "Pendente" });

      cy.request(`/api/pagamentos?jogador_id=${jogador.id}&status=Pago&pagina=1&limite=1`).then(({ body }) => {
        expect(body.pagamentos).to.have.length(1);
        expect(body.total).to.eq(2);
        expect(body.totalPaginas).to.eq(2);
        expect(body.totalPago).to.eq(30); // soma de TODOS os pagos do filtro, não só da página
      });
    });
  });

  it("o painel reflete os lançamentos do mês", () => {
    const mes = "2025-07"; // mês sem outros lançamentos dos testes
    cy.criarJogador({ valorMensalidade: "100" }).then((jogador) => {
      cy.criarPagamento({ jogador_id: jogador.id, data_pagamento: `${mes}-05`, valor: "100" });
      cy.request(`/api/dashboard?mes=${mes}`).then(({ body }) => {
        expect(body.mes).to.eq(mes);
        expect(body.totalPagoMes).to.be.at.least(100);
        expect(body.semLancamentoNoMes.map((item) => item.id)).not.to.include(jogador.id);
        expect(body.evolucao).to.have.length(6);
      });
    });
  });
});
