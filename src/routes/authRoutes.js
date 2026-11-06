/**
 * ROTAS DE AUTENTICAÇÃO
 * ---------------------
 * express.Router() cria um "mini aplicativo" de rotas que depois é encaixado
 * no app principal com app.use("/api", authRoutes).
 * Então router.post("/login") vira POST /api/login.
 *
 * | Método | URL          | Acesso     | Ação                      |
 * |--------|--------------|------------|---------------------------|
 * | POST   | /api/login   | público    | autentica e cria a sessão |
 * | GET    | /api/logout  | público    | encerra a sessão          |
 * | GET    | /api/sessao  | protegido  | dados do usuário logado   |
 */
const express = require("express");
const authController = require("../controllers/authController");
const { exigirAutenticacao } = require("../middlewares/autenticacao");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

router.post("/login", capturarErros(authController.login));
router.get("/logout", authController.logout);
// Middleware na própria rota: exigirAutenticacao roda antes do controller.
router.get("/sessao", exigirAutenticacao, authController.sessaoAtual);

module.exports = router;
