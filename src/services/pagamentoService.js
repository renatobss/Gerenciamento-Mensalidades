/**
 * SERVICE DE PAGAMENTOS
 * ---------------------
 * Responsabilidade: as REGRAS DE NEGÓCIO e o acesso ao banco para pagamentos.
 *
 * Divisão de responsabilidades usada no projeto:
 *   Route      → define a URL e o método HTTP (GET, POST...)
 *   Controller → lê a requisição (req) e monta a resposta (res)
 *   Service    → aplica as regras e conversa com o banco  ← você está aqui
 *
 * O service não conhece "req" nem "res". Ele recebe dados simples e devolve
 * dados simples. Isso permite reaproveitá-lo (ex.: no dashboard) e testá-lo
 * isoladamente.
 *
 * Segurança: todas as consultas usam "?" (parâmetros). O banco trata o valor
 * como DADO e nunca como parte do comando SQL, o que impede SQL Injection.
 */
const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validarPagamento, converterId } = require("../validators/pagamentoValidator");

// Colunas devolvidas pela API. Centralizar evita repetir a lista em cada SELECT.
const COLUNAS = "id, jogador, data_pagamento, valor, status";

/**
 * Busca um pagamento pelo id.
 * @param {number} id
 * @returns {object|undefined} O pagamento, ou undefined se não existir.
 */
function buscarPorId(id) {
  return db.prepare(`SELECT ${COLUNAS} FROM pagamentos WHERE id = ?`).get(id);
}

/**
 * Soma o valor dos pagamentos que têm determinado status.
 * Conceito: filter (seleciona itens) + reduce (acumula um resultado).
 *
 * @param {object[]} pagamentos
 * @param {string} status - "Pago" ou "Pendente".
 * @returns {number}
 */
function somarPorStatus(pagamentos, status) {
  return pagamentos
    .filter((pagamento) => pagamento.status === status)
    .reduce((soma, pagamento) => soma + pagamento.valor, 0);
}

/**
 * Lista os pagamentos, opcionalmente filtrando por mês, e calcula os totais.
 *
 * @param {string} [mes] - Mês no formato AAAA-MM (ex.: "2026-11"). Vazio = todos.
 * @returns {{ pagamentos: object[], totalPago: number, totalPendente: number }}
 */
function listar(mes) {
  let pagamentos;

  if (mes) {
    // substr(data, 1, 7) pega "AAAA-MM" de "AAAA-MM-DD" para comparar com o mês.
    pagamentos = db.prepare(`
      SELECT ${COLUNAS}
      FROM pagamentos
      WHERE substr(data_pagamento, 1, 7) = ?
      ORDER BY data_pagamento DESC, id DESC
    `).all(mes);
  } else {
    pagamentos = db.prepare(`
      SELECT ${COLUNAS}
      FROM pagamentos
      ORDER BY data_pagamento DESC, id DESC
    `).all();
  }

  return {
    pagamentos,
    totalPago: somarPorStatus(pagamentos, "Pago"),
    totalPendente: somarPorStatus(pagamentos, "Pendente")
  };
}

/**
 * Cadastra um novo pagamento.
 *
 * @param {object} dados - Dados recebidos do cliente.
 * @returns {object} O pagamento criado (com id).
 * @throws {AppError} 400 se os dados forem inválidos.
 */
function criar(dados) {
  const { erros, pagamento } = validarPagamento(dados);

  if (erros.length > 0) {
    throw new AppError(erros, 400);
  }

  const resultado = db.prepare(`
    INSERT INTO pagamentos (jogador, data_pagamento, valor, status)
    VALUES (?, ?, ?, ?)
  `).run(pagamento.jogador, pagamento.data_pagamento, pagamento.valor, pagamento.status);

  // lastInsertRowid = id gerado automaticamente pelo AUTOINCREMENT.
  return buscarPorId(resultado.lastInsertRowid);
}

/**
 * Atualiza um pagamento existente.
 *
 * @param {string} idTexto - Id vindo da URL.
 * @param {object} dados - Novos dados.
 * @returns {object} O pagamento atualizado.
 * @throws {AppError} 400 (id/dados inválidos) ou 404 (não encontrado).
 */
function atualizar(idTexto, dados) {
  const id = converterId(idTexto);

  if (!id) {
    throw new AppError("ID invalido.", 400);
  }

  const { erros, pagamento } = validarPagamento(dados);

  if (erros.length > 0) {
    throw new AppError(erros, 400);
  }

  const resultado = db.prepare(`
    UPDATE pagamentos
    SET jogador = ?, data_pagamento = ?, valor = ?, status = ?
    WHERE id = ?
  `).run(pagamento.jogador, pagamento.data_pagamento, pagamento.valor, pagamento.status, id);

  // changes = quantidade de linhas afetadas. Zero = nenhum registro com esse id.
  if (resultado.changes === 0) {
    throw new AppError("Pagamento nao encontrado.", 404);
  }

  return buscarPorId(id);
}

/**
 * Exclui um pagamento.
 * Observação: hoje a exclusão é FÍSICA (o registro some do banco). Em uma
 * próxima etapa será trocada por cancelamento lógico (status "Cancelado"),
 * preservando o histórico financeiro.
 *
 * @param {string} idTexto - Id vindo da URL.
 * @throws {AppError} 400 (id inválido) ou 404 (não encontrado).
 */
function excluir(idTexto) {
  const id = converterId(idTexto);

  if (!id) {
    throw new AppError("ID invalido.", 400);
  }

  const resultado = db.prepare("DELETE FROM pagamentos WHERE id = ?").run(id);

  if (resultado.changes === 0) {
    throw new AppError("Pagamento nao encontrado.", 404);
  }
}

module.exports = { listar, criar, atualizar, excluir };
