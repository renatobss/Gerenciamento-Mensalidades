/**
 * ROTA DO DASHBOARD (qualquer usuário logado)
 * -------------------------------------------
 * GET /api/dashboard?mes=AAAA-MM → indicadores do painel inicial.
 *
 * Como o controller seria uma única linha, a função fica aqui mesmo.
 * Quando a lógica crescer, ela pode ser movida para um controller próprio.
 */
const express = require("express");
const dashboardService = require("../services/dashboardService");
const { exigirAutenticacao } = require("../middlewares/autenticacao");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

router.get("/", exigirAutenticacao, capturarErros((req, res) => {
  res.json(dashboardService.obterResumo(req.query.mes));
}));

module.exports = router;
