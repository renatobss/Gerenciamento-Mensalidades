/**
 * ROTAS DE AUTENTICAÇÃO (públicas)
 * --------------------------------
 * express.Router() cria um "mini aplicativo" de rotas que depois é encaixado
 * no app principal com app.use("/api", authRoutes).
 * Então router.post("/login") vira POST /api/login.
 */
const express = require("express");
const authController = require("../controllers/authController");
const capturarErros = require("../utils/capturarErros");

const router = express.Router();

router.post("/login", capturarErros(authController.login));
router.get("/logout", authController.logout);

module.exports = router;
