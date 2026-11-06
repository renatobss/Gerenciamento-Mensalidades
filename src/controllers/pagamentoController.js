/**
 * CONTROLLER DE PAGAMENTOS
 * ------------------------
 * Responsabilidade: ser a "ponte" entre o HTTP e o service.
 *   1. Lê o que veio na requisição (req.query, req.params, req.body).
 *   2. Chama a função do service.
 *   3. Devolve a resposta com o status HTTP correto.
 *
 * O controller NÃO valida regras nem acessa o banco: isso é papel do service.
 */
const pagamentoService = require("../services/pagamentoService");

/**
 * GET /api/pagamentos?mes=AAAA-MM&jogador_id=&status=&pagina=&limite=
 * → 200 com { pagamentos, totalPago, totalPendente, total, pagina, limite, totalPaginas }
 */
function listar(req, res) {
  res.json(pagamentoService.listar(req.query));
}

/** POST /api/pagamentos → 201 (Created) com o pagamento criado */
function criar(req, res) {
  res.status(201).json(pagamentoService.criar(req.body || {}));
}

/** PUT /api/pagamentos/:id → 200 com o pagamento atualizado */
function atualizar(req, res) {
  res.json(pagamentoService.atualizar(req.params.id, req.body || {}));
}

/** PATCH /api/pagamentos/:id/cancelar → 200 com o pagamento cancelado */
function cancelar(req, res) {
  res.json(pagamentoService.cancelar(req.params.id));
}

/**
 * DELETE /api/pagamentos/:id → 204
 * Mantido por compatibilidade com a versão anterior, mas agora CANCELA o
 * pagamento em vez de apagá-lo (o histórico financeiro é preservado).
 */
function excluir(req, res) {
  pagamentoService.cancelar(req.params.id);
  res.status(204).send();
}

module.exports = { listar, criar, atualizar, cancelar, excluir };
