/**
 * ROTAS DE JOGADORES (qualquer usuário logado)
 * --------------------------------------------
 * Montadas em src/app.js com app.use("/api/jogadores", jogadorRoutes).
 *
 * | Método | URL                          | Ação                              |
 * |--------|------------------------------|-----------------------------------|
 * | GET    | /api/jogadores               | listar (pesquisa/filtro/paginação)|
 * | GET    | /api/jogadores/opcoes        | jogadores ativos para selects     |
 * | GET    | /api/jogadores/:id           | consultar                         |
 * | POST   | /api/jogadores               | cadastrar                         |
 * | PUT    | /api/jogadores/:id           | editar                            |
 * | PATCH  | /api/jogadores/:id/inativar  | inativar                          |
 *
 * ATENÇÃO À ORDEM: "/opcoes" precisa vir ANTES de "/:id". O Express testa as
 * rotas de cima para baixo, e "/:id" também "casaria" com "/opcoes"
 * (com id = "opcoes").
 */
const express = require("express");
const jogadorController = require("../controllers/jogadorController");
const { exigirAutenticacao } = require("../middlewares/autenticacao");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

router.use(exigirAutenticacao);

router.get("/", capturarErros(jogadorController.listar));
router.get("/opcoes", capturarErros(jogadorController.listarOpcoes));
router.get("/:id", capturarErros(jogadorController.buscar));
router.post("/", capturarErros(jogadorController.criar));
router.put("/:id", capturarErros(jogadorController.atualizar));
router.patch("/:id/inativar", capturarErros(jogadorController.inativar));

module.exports = router;
