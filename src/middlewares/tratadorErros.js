/**
 * TRATAMENTO CENTRALIZADO DE ERROS
 * --------------------------------
 * O Express reconhece um middleware de ERRO por ter 4 parâmetros
 * (erro, req, res, next). Ele só é executado quando alguém chama next(erro)
 * ou quando uma rota lança uma exceção.
 *
 * Vantagem: em vez de try/catch com res.status(...) espalhado em cada rota,
 * todas as respostas de erro são montadas aqui, sempre no mesmo formato:
 *   { "erros": ["mensagem 1", "mensagem 2"] }
 * Um formato único facilita o frontend e os testes automatizados.
 */
const AppError = require("../utils/AppError");

/**
 * Responde 404 em JSON para rotas de API que não existem.
 * (Sem isso, o Express devolveria uma página HTML "Cannot GET ...".)
 */
function rotaApiNaoEncontrada(req, res) {
  res.status(404).json({ erros: ["Rota não encontrada."] });
}

/**
 * Converte qualquer erro em uma resposta HTTP padronizada.
 *
 * @param {Error} erro - O erro lançado.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next - Obrigatório na assinatura,
 *   mesmo sem uso: é o 4º parâmetro que identifica um middleware de erro.
 */
// eslint-disable-next-line no-unused-vars
function tratadorErros(erro, req, res, next) {
  // Erro esperado (regra de negócio/validação): mensagem segura para o usuário.
  if (erro instanceof AppError) {
    return res.status(erro.statusCode).json({ erros: erro.erros });
  }

  // O express.json() lança este erro quando o corpo não é um JSON válido.
  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erros: ["JSON inválido no corpo da requisição."] });
  }

  // Erro inesperado: registramos o detalhe no console do servidor, mas o
  // cliente recebe só uma mensagem genérica (não expomos detalhes internos).
  console.error("[ERRO INTERNO]", erro);
  return res.status(500).json({ erros: ["Erro interno no servidor. Tente novamente mais tarde."] });
}

module.exports = { rotaApiNaoEncontrada, tratadorErros };
