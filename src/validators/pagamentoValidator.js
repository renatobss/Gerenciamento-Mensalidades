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
 */

// Lista única de status aceitos. Centralizar evita digitar "Pago" em vários lugares.
const STATUS_VALIDOS = ["Pago", "Pendente"];

/**
 * Valida e normaliza os dados de um pagamento.
 *
 * @param {object} dados - Corpo da requisição (req.body).
 * @param {string} dados.jogador - Nome do jogador.
 * @param {string} dados.data_pagamento - Data no formato AAAA-MM-DD.
 * @param {string|number} dados.valor - Valor; aceita vírgula ou ponto decimal.
 * @param {string} [dados.status="Pago"] - "Pago" ou "Pendente".
 * @returns {{ erros: string[], pagamento: object }}
 *   "erros" vazio significa dados válidos; "pagamento" traz os dados já
 *   convertidos (texto sem espaços extras, valor como número).
 */
function validarPagamento(dados = {}) {
  const erros = [];

  // String(x || "") protege contra undefined/null; trim() remove espaços das pontas.
  const jogador = String(dados.jogador || "").trim();
  const dataPagamento = String(dados.data_pagamento || "").trim();
  const valor = Number(String(dados.valor || "").replace(",", "."));
  const status = String(dados.status || "Pago").trim();

  if (!jogador) {
    erros.push("Informe o nome do jogador.");
  }

  // Monta a data com horário fixo para o JavaScript interpretar no fuso local.
  // Se a data for inválida, getTime() devolve NaN.
  if (!dataPagamento || Number.isNaN(new Date(`${dataPagamento}T00:00:00`).getTime())) {
    erros.push("Informe uma data de pagamento valida.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    erros.push("Informe um valor maior que zero.");
  }

  if (!STATUS_VALIDOS.includes(status)) {
    erros.push("Escolha um status valido.");
  }

  return {
    erros,
    pagamento: {
      jogador,
      data_pagamento: dataPagamento,
      valor,
      status
    }
  };
}

/**
 * Converte e valida um id vindo da URL (req.params.id chega sempre como texto).
 *
 * @param {string} idTexto - Ex.: "15".
 * @returns {number|null} O id numérico, ou null se não for um inteiro positivo.
 */
function converterId(idTexto) {
  const id = Number(idTexto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { validarPagamento, converterId, STATUS_VALIDOS };
