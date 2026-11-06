/**
 * VALIDAÇÕES DE PAGAMENTO
 * -----------------------
 * Responsabilidade: conferir e "limpar" (normalizar) os dados recebidos antes
 * que cheguem ao banco.
 *
 * Por que validar no backend se o frontend já valida? Porque qualquer pessoa
 * pode chamar a API diretamente (Postman, curl, Cypress cy.request...) e pular
 * o frontend. A validação do backend é a que realmente protege os dados; a do
 * frontend serve só para dar um retorno mais rápido ao usuário.
 *
 * Desde a Etapa 4, o pagamento aponta para um jogador cadastrado (jogador_id).
 * A existência e a situação do jogador são conferidas no pagamentoService,
 * porque exigem consulta ao banco.
 */
const { converterId } = require("../utils/consultas");
const { ehDataValida, converterValorMonetario } = require("../utils/validacoes");

// Status que podem ser ESCOLHIDOS no formulário. "Cancelado" existe, mas só é
// aplicado pela ação de cancelar (PATCH /api/pagamentos/:id/cancelar).
const STATUS_VALIDOS = ["Pago", "Pendente"];
const STATUS_CANCELADO = "Cancelado";

/**
 * Valida e normaliza os dados de um pagamento.
 *
 * @param {object} dados - Corpo da requisição (req.body).
 * @param {number|string} dados.jogador_id - Id do jogador cadastrado.
 * @param {string} dados.data_pagamento - Data no formato AAAA-MM-DD.
 * @param {string|number} dados.valor - Valor; aceita "80", "80,50" ou "1.234,56".
 * @param {string} [dados.status="Pago"] - "Pago" ou "Pendente".
 * @returns {{ erros: string[], pagamento: object }}
 *   "erros" vazio significa dados válidos; "pagamento" traz os dados convertidos.
 */
function validarPagamento(dados = {}) {
  const erros = [];

  const jogadorId = converterId(dados.jogador_id);
  const dataPagamento = String(dados.data_pagamento || "").trim();
  const valor = converterValorMonetario(dados.valor);
  const status = String(dados.status || "Pago").trim();

  if (!jogadorId) {
    erros.push("Selecione o jogador.");
  }

  if (!ehDataValida(dataPagamento)) {
    erros.push("Informe uma data de pagamento válida.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    erros.push("Informe um valor maior que zero.");
  }

  if (!STATUS_VALIDOS.includes(status)) {
    erros.push("Escolha um status válido.");
  }

  return {
    erros,
    pagamento: {
      jogadorId,
      data_pagamento: dataPagamento,
      valor: Math.round(valor * 100) / 100,
      status
    }
  };
}

// converterId mora em src/utils/consultas.js (é usado por vários módulos).
// Continua exportado aqui para não quebrar quem já importava deste arquivo.
module.exports = { validarPagamento, converterId, STATUS_VALIDOS, STATUS_CANCELADO };
