/**
 * CONTROLLER DE JOGADORES
 * -----------------------
 * Ponte entre o HTTP e o jogadorService (sem regras de negócio aqui).
 */
const jogadorService = require("../services/jogadorService");

/** GET /api/jogadores?busca=&status=&pagina=&limite= → 200 com lista paginada */
function listar(req, res) {
  res.json(jogadorService.listar(req.query));
}

/** GET /api/jogadores/opcoes[?incluirInativos=1] → 200 com a lista para selects */
function listarOpcoes(req, res) {
  res.json(jogadorService.listarOpcoes(req.query.incluirInativos === "1"));
}

/** GET /api/jogadores/:id → 200 com o jogador */
function buscar(req, res) {
  res.json(jogadorService.obterExistente(req.params.id));
}

/** POST /api/jogadores → 201 com o jogador criado */
function criar(req, res) {
  res.status(201).json(jogadorService.criar(req.body || {}));
}

/** PUT /api/jogadores/:id → 200 com o jogador atualizado */
function atualizar(req, res) {
  res.json(jogadorService.atualizar(req.params.id, req.body || {}));
}

/** PATCH /api/jogadores/:id/inativar → 200 com o jogador inativado */
function inativar(req, res) {
  res.json(jogadorService.inativar(req.params.id));
}

module.exports = { listar, listarOpcoes, buscar, criar, atualizar, inativar };
