/**
 * ROTAS DE PAGAMENTOS (protegidas)
 * --------------------------------
 * Montadas em src/app.js com app.use("/api/pagamentos", pagamentoRoutes).
 *
 * | Método | URL                     | Ação                 |
 * |--------|-------------------------|----------------------|
 * | GET    | /api/pagamentos?mes=... | listar (com totais)  |
 * | POST   | /api/pagamentos         | cadastrar            |
 * | PUT    | /api/pagamentos/:id     | atualizar            |
 * | DELETE | /api/pagamentos/:id     | excluir              |
 *
 * ":id" é um PARÂMETRO DE ROTA: em /api/pagamentos/15, req.params.id = "15".
 */
const express = require("express");
const pagamentoController = require("../controllers/pagamentoController");
const { exigirAutenticacao } = require("../middlewares/autenticacao");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

// router.use aplica o middleware a TODAS as rotas deste arquivo.
// Mesmo que o app.js já proteja as rotas, repetir aqui é "defesa em
// profundidade": se a ordem no app.js mudar por engano, a API continua protegida.
router.use(exigirAutenticacao);

router.get("/", capturarErros(pagamentoController.listar));
router.post("/", capturarErros(pagamentoController.criar));
router.put("/:id", capturarErros(pagamentoController.atualizar));
router.delete("/:id", capturarErros(pagamentoController.excluir));

module.exports = router;
