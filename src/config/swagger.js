/**
 * DOCUMENTAÇÃO INTERATIVA DA API (SWAGGER UI)
 * -------------------------------------------
 * - docs/openapi.yaml: o CONTRATO da API, escrito no padrão OpenAPI 3.
 * - swagger-ui-express: transforma esse contrato em uma página interativa,
 *   onde dá para ler cada rota e testá-la pelo botão "Try it out".
 * - yaml: converte o arquivo YAML em objeto JavaScript (o Swagger UI espera um objeto).
 *
 * Rotas criadas:
 *   GET /api-docs            → página do Swagger UI
 *   GET /api-docs/openapi.json → o contrato em JSON (útil para importar no Postman)
 *
 * Segurança: o app.js registra isto DEPOIS de protegerRecursos, então só quem
 * está logado vê a documentação. Como a página está no MESMO endereço da API,
 * o navegador envia o cookie da sessão nas chamadas do "Try it out".
 *
 * O arquivo é lido uma única vez, quando o servidor sobe. Ao editar o YAML,
 * o servidor precisa reiniciar: o "npm run dev" faz isso sozinho, pois o
 * nodemon foi configurado com "--ext js,yaml" no package.json.
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");

const CAMINHO_CONTRATO = path.join(__dirname, "..", "..", "docs", "openapi.yaml");

/**
 * Cria o roteador da documentação.
 * @returns {import("express").Router}
 */
function criarRotasDocumentacao() {
  const contrato = YAML.parse(fs.readFileSync(CAMINHO_CONTRATO, "utf8"));
  const router = express.Router();

  router.get("/openapi.json", (req, res) => res.json(contrato));

  router.use("/", swaggerUi.serve, swaggerUi.setup(contrato, {
    customSiteTitle: "API Mensalidades - Swagger",
    swaggerOptions: {
      docExpansion: "none",          // começa com as rotas recolhidas
      persistAuthorization: true,
      withCredentials: true          // envia o cookie da sessão no "Try it out"
    }
  }));

  return router;
}

module.exports = { criarRotasDocumentacao };
