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
 * Regras (Etapa 4):
 * - Todo pagamento pertence a um JOGADOR cadastrado (jogador_id).
 * - Jogador INATIVO não recebe novos pagamentos (mas os antigos continuam).
 * - Não existe mais exclusão física: o pagamento é CANCELADO (status
 *   "Cancelado"), preservando o histórico financeiro. Cancelados não entram
 *   nos totais e não podem ser editados.
 *
 * Segurança: todas as consultas usam "?" (parâmetros), o que impede SQL Injection.
 */
const db = require("../config/database");
const AppError = require("../utils/AppError");
const jogadorService = require("./jogadorService");
const { converterId } = require("../utils/consultas");
const { validarPagamento, STATUS_CANCELADO } = require("../validators/pagamentoValidator");

/**
 * Colunas devolvidas pela API.
 *
 * LEFT JOIN: junta cada pagamento com o seu jogador. "LEFT" garante que o
 * pagamento apareça mesmo se, por algum motivo, não houver jogador ligado.
 * coalesce(j.nome_completo, p.jogador): usa o nome ATUAL do cadastro; se não
 * houver vínculo, usa o nome em texto gravado no pagamento.
 */
const COLUNAS = `
  p.id,
  p.jogador_id,
  coalesce(j.nome_completo, p.jogador) AS jogador,
  p.data_pagamento,
  p.valor,
  p.status
`;
const FROM = "FROM pagamentos p LEFT JOIN jogadores j ON j.id = p.jogador_id";

/**
 * Busca um pagamento pelo id.
 * @param {number} id
 * @returns {object|undefined}
 */
function buscarPorId(id) {
  return db.prepare(`SELECT ${COLUNAS} ${FROM} WHERE p.id = ?`).get(id);
}

/**
 * Converte o id da URL e garante que o pagamento exista.
 * @param {string} idTexto
 * @returns {object}
 * @throws {AppError} 400 ou 404.
 */
function obterExistente(idTexto) {
  const id = converterId(idTexto);
  if (!id) {
    throw new AppError("ID invalido.", 400);
  }
  const pagamento = buscarPorId(id);
  if (!pagamento) {
    throw new AppError("Pagamento nao encontrado.", 404);
  }
  return pagamento;
}

/**
 * Soma o valor dos pagamentos que têm determinado status.
 * Conceito: filter (seleciona itens) + reduce (acumula um resultado).
 * @param {object[]} pagamentos
 * @param {string} status
 * @returns {number}
 */
function somarPorStatus(pagamentos, status) {
  return pagamentos
    .filter((pagamento) => pagamento.status === status)
    .reduce((soma, pagamento) => soma + pagamento.valor, 0);
}

/**
 * Lista os pagamentos, opcionalmente filtrando por mês, e calcula os totais.
 * Cancelados aparecem na lista (histórico), mas não entram nos totais.
 *
 * @param {string} [mes] - Mês no formato AAAA-MM. Vazio = todos.
 * @returns {{ pagamentos: object[], totalPago: number, totalPendente: number }}
 */
function listar(mes) {
  const pagamentos = mes
    ? db.prepare(`
        SELECT ${COLUNAS} ${FROM}
        WHERE substr(p.data_pagamento, 1, 7) = ?
        ORDER BY p.data_pagamento DESC, p.id DESC
      `).all(mes)
    : db.prepare(`
        SELECT ${COLUNAS} ${FROM}
        ORDER BY p.data_pagamento DESC, p.id DESC
      `).all();

  return {
    pagamentos,
    totalPago: somarPorStatus(pagamentos, "Pago"),
    totalPendente: somarPorStatus(pagamentos, "Pendente")
  };
}

/**
 * Valida os dados e confere o jogador.
 * @param {object} dados - Corpo da requisição.
 * @param {number|null} [jogadorIdAtual] - Na edição, o jogador já vinculado
 *   pode continuar mesmo que tenha sido inativado depois.
 * @returns {{ pagamento: object, jogador: object }}
 * @throws {AppError} 400 ou 404.
 */
function validarComJogador(dados, jogadorIdAtual = null) {
  const { erros, pagamento } = validarPagamento(dados);
  if (erros.length > 0) {
    throw new AppError(erros, 400);
  }

  const jogador = jogadorService.obterExistente(pagamento.jogadorId);
  if (!jogador.ativo && jogador.id !== jogadorIdAtual) {
    throw new AppError("Jogador inativo não pode receber novos pagamentos.", 400);
  }
  return { pagamento, jogador };
}

/**
 * Cadastra um novo pagamento.
 * A coluna de texto "jogador" continua sendo preenchida com o nome do jogador
 * (histórico e compatibilidade com a estrutura antiga).
 *
 * @param {object} dados
 * @returns {object} O pagamento criado.
 * @throws {AppError} 400 ou 404.
 */
function criar(dados) {
  const { pagamento, jogador } = validarComJogador(dados);

  const resultado = db.prepare(`
    INSERT INTO pagamentos (jogador_id, jogador, data_pagamento, valor, status)
    VALUES (?, ?, ?, ?, ?)
  `).run(jogador.id, jogador.nomeCompleto, pagamento.data_pagamento, pagamento.valor, pagamento.status);

  return buscarPorId(resultado.lastInsertRowid);
}

/**
 * Atualiza um pagamento existente (cancelados não podem ser editados).
 * @param {string} idTexto
 * @param {object} dados
 * @returns {object} O pagamento atualizado.
 * @throws {AppError} 400 ou 404.
 */
function atualizar(idTexto, dados) {
  const atual = obterExistente(idTexto);

  if (atual.status === STATUS_CANCELADO) {
    throw new AppError("Pagamento cancelado não pode ser editado.", 400);
  }

  const { pagamento, jogador } = validarComJogador(dados, atual.jogador_id);

  db.prepare(`
    UPDATE pagamentos
    SET jogador_id = ?, jogador = ?, data_pagamento = ?, valor = ?, status = ?
    WHERE id = ?
  `).run(jogador.id, jogador.nomeCompleto, pagamento.data_pagamento, pagamento.valor, pagamento.status, atual.id);

  return buscarPorId(atual.id);
}

/**
 * Cancela um pagamento (exclusão LÓGICA: o registro continua no banco).
 * Cancelar algo já cancelado não gera erro (operação "idempotente").
 * @param {string} idTexto
 * @returns {object} O pagamento cancelado.
 * @throws {AppError} 400 ou 404.
 */
function cancelar(idTexto) {
  const atual = obterExistente(idTexto);
  db.prepare("UPDATE pagamentos SET status = ? WHERE id = ?").run(STATUS_CANCELADO, atual.id);
  return buscarPorId(atual.id);
}

module.exports = { listar, criar, atualizar, cancelar };
