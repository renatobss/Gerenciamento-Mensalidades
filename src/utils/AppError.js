/**
 * ERRO DE APLICAÇÃO (erro "esperado")
 * ----------------------------------
 * Existem dois tipos de erro em uma API:
 *
 * 1. Erros ESPERADOS: o usuário mandou dados inválidos, o registro não existe,
 *    a senha está errada... Nós sabemos o que aconteceu e queremos devolver
 *    uma mensagem amigável com o status HTTP correto (400, 401, 404...).
 * 2. Erros INESPERADOS: bug no código, banco corrompido etc. Esses viram
 *    status 500 e a mensagem real NÃO deve ir para o cliente (pode expor
 *    detalhes internos do sistema).
 *
 * Esta classe representa o tipo 1. Os services fazem "throw new AppError(...)"
 * e o middleware tratadorErros (src/middlewares/tratadorErros.js) transforma
 * o erro na resposta JSON padrão do projeto: { "erros": ["mensagem", ...] }.
 *
 * Conceito: HERANÇA. "extends Error" faz AppError ser um Error de verdade
 * (tem stack trace, funciona com throw/try/catch), mas com campos extras.
 */
class AppError extends Error {
  /**
   * @param {string|string[]} mensagens - Uma mensagem ou uma lista de mensagens.
   * @param {number} [statusCode=400] - Status HTTP que será devolvido ao cliente.
   */
  constructor(mensagens, statusCode = 400) {
    // Normaliza: sempre trabalhamos com uma lista de mensagens.
    const lista = Array.isArray(mensagens) ? mensagens : [mensagens];

    super(lista.join(" ")); // chama o construtor da classe pai (Error)
    this.name = "AppError";
    this.erros = lista;
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
