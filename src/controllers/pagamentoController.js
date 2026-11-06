/**
 * CONTROLLER DE PAGAMENTOS
 * ------------------------
 * Responsabilidade: ser a "ponte" entre o HTTP e o service.
 *   1. Lê o que veio na requisição (req.query, req.params, req.body).
 *   2. Chama a função do service.
 *   3. Devolve a resposta com o status HTTP correto.
 *
 * O controller NÃO valida regras nem acessa o banco: isso é papel do service.
 * Se o service lançar um AppError, o wrapper capturarErros (usado nas rotas)
 * envia o erro para o middleware tratadorErros.
 */
const pagamentoService = require("../services/pagamentoService");

/** GET /api/pagamentos?mes=AAAA-MM → 200 com { pagamentos, totalPago, totalPendente } */
function listar(req, res) {
  const mes = String(req.query.mes || "").trim();
  res.json(pagamentoService.listar(mes));
}

/** POST /api/pagamentos → 201 (Created) com o pagamento criado */
function criar(req, res) {
  const pagamentoCriado = pagamentoService.criar(req.body);
  res.status(201).json(pagamentoCriado);
}

/** PUT /api/pagamentos/:id → 200 com o pagamento atualizado */
function atualizar(req, res) {
  const pagamentoAtualizado = pagamentoService.atualizar(req.params.id, req.body);
  res.json(pagamentoAtualizado);
}

/** DELETE /api/pagamentos/:id → 204 (No Content): sucesso, sem corpo na resposta */
function excluir(req, res) {
  pagamentoService.excluir(req.params.id);
  res.status(204).send();
}

module.exports = { listar, criar, atualizar, excluir };
