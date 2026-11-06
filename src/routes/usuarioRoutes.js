/**
 * ROTAS DE USUÁRIOS (somente ADMINISTRADOR)
 * -----------------------------------------
 * Montadas em src/app.js com app.use("/api/usuarios", usuarioRoutes).
 *
 * | Método | URL                          | Ação                         |
 * |--------|------------------------------|------------------------------|
 * | GET    | /api/usuarios                | listar (pesquisa/paginação)  |
 * | GET    | /api/usuarios/:id            | consultar                    |
 * | POST   | /api/usuarios                | cadastrar                    |
 * | PUT    | /api/usuarios/:id            | editar                       |
 * | PATCH  | /api/usuarios/:id/inativar   | inativar                     |
 *
 * Por que PATCH para inativar? PUT substitui o recurso inteiro; PATCH altera
 * apenas uma parte dele (aqui, só a situação).
 */
const express = require("express");
const usuarioController = require("../controllers/usuarioController");
const { exigirAutenticacao } = require("../middlewares/autenticacao");
const { exigirPerfil } = require("../middlewares/autorizacao");
const { PERFIS } = require("../config/perfis");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

// Dupla verificação, nesta ordem:
// 1º AUTENTICAÇÃO: quem é você? (está logado?) → senão 401
// 2º AUTORIZAÇÃO: você pode fazer isso? (é admin?) → senão 403
router.use(exigirAutenticacao, exigirPerfil(PERFIS.ADMIN));

router.get("/", capturarErros(usuarioController.listar));
router.get("/:id", capturarErros(usuarioController.buscar));
router.post("/", capturarErros(usuarioController.criar));
router.put("/:id", capturarErros(usuarioController.atualizar));
router.patch("/:id/inativar", capturarErros(usuarioController.inativar));

module.exports = router;
