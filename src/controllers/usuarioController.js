/**
 * CONTROLLER DE USUÁRIOS
 * ----------------------
 * Ponte entre o HTTP e o usuarioService.
 * "req.usuario" é preenchido pelo middleware exigirAutenticacao com o usuário
 * logado; usamos o id dele para aplicar as regras de autoproteção.
 */
const usuarioService = require("../services/usuarioService");

/** GET /api/usuarios?busca=&status=&pagina=&limite= → 200 com lista paginada */
function listar(req, res) {
  res.json(usuarioService.listar(req.query));
}

/** GET /api/usuarios/:id → 200 com o usuário */
function buscar(req, res) {
  res.json(usuarioService.obterExistente(req.params.id));
}

/** POST /api/usuarios → 201 com o usuário criado */
async function criar(req, res) {
  const usuario = await usuarioService.criar(req.body || {});
  res.status(201).json(usuario);
}

/** PUT /api/usuarios/:id → 200 com o usuário atualizado */
async function atualizar(req, res) {
  const usuario = await usuarioService.atualizar(req.params.id, req.body || {}, req.usuario.id);
  res.json(usuario);
}

/** PATCH /api/usuarios/:id/inativar → 200 com o usuário inativado */
function inativar(req, res) {
  res.json(usuarioService.inativar(req.params.id, req.usuario.id));
}

module.exports = { listar, buscar, criar, atualizar, inativar };
