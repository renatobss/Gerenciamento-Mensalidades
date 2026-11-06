/**
 * CAPTURA DE ERROS NOS CONTROLLERS
 * --------------------------------
 * Problema: no Express 4, se uma função "async" lançar um erro, o Express NÃO
 * percebe sozinho. A requisição fica "pendurada" e o servidor registra um
 * "UnhandledPromiseRejection".
 *
 * Solução: envolver o controller em uma função que faz try/catch e repassa o
 * erro para next(erro). Quando chamamos next com um argumento, o Express pula
 * todas as rotas e vai direto para o middleware de erro (tratadorErros).
 *
 * Conceito: HIGHER-ORDER FUNCTION (função de ordem superior) — uma função que
 * recebe uma função e devolve outra função.
 *
 * Hoje nossos controllers são síncronos (o SQLite usado é síncrono), mas usar
 * este wrapper desde já evita bugs quando algum ficar assíncrono no futuro.
 *
 * @param {Function} controller - Função (req, res, next) do controller.
 * @returns {Function} Nova função (req, res, next) protegida contra erros.
 *
 * @example
 * router.get("/", capturarErros(pagamentoController.listar));
 */
function capturarErros(controller) {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (erro) {
      next(erro);
    }
  };
}

module.exports = capturarErros;
