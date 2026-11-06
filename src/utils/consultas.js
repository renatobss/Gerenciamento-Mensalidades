/**
 * UTILITÁRIOS DE CONSULTA (paginação e pesquisa)
 * ----------------------------------------------
 * Funções reaproveitadas por todas as listagens (usuários, jogadores...).
 */

/**
 * Lê "pagina" e "limite" da query string e calcula o OFFSET do SQL.
 *
 * Paginação no SQL: LIMIT = quantos registros trazer; OFFSET = quantos pular.
 * Página 3 com 10 por página → pula 20 (OFFSET 20) e traz 10 (LIMIT 10).
 *
 * @param {object} query - req.query.
 * @param {number} [limitePadrao=10]
 * @returns {{ pagina: number, limite: number, offset: number }}
 */
function lerPaginacao(query = {}, limitePadrao = 10) {
  const pagina = Math.max(1, Number.parseInt(query.pagina, 10) || 1);
  // Limite máximo de 100 por página: evita que alguém peça 1 milhão de registros.
  const limite = Math.min(100, Math.max(1, Number.parseInt(query.limite, 10) || limitePadrao));

  return { pagina, limite, offset: (pagina - 1) * limite };
}

/**
 * Monta o objeto de resposta padrão das listagens paginadas.
 * @param {object[]} itens - Registros da página atual.
 * @param {number} total - Total de registros que atendem ao filtro.
 * @param {{ pagina: number, limite: number }} paginacao
 * @returns {{ itens: object[], total: number, pagina: number, limite: number, totalPaginas: number }}
 */
function montarRespostaPaginada(itens, total, { pagina, limite }) {
  return {
    itens,
    total,
    pagina,
    limite,
    totalPaginas: Math.max(1, Math.ceil(total / limite))
  };
}

/**
 * Prepara um termo de pesquisa para o operador LIKE do SQL.
 *
 * No LIKE, "%" significa "qualquer texto" e "_" significa "um caractere".
 * Se o usuário digitar esses símbolos, precisamos "escapá-los" (com "\") para
 * que sejam procurados literalmente. O SQL deve usar: LIKE ? ESCAPE '\'
 *
 * @param {unknown} termo - Texto digitado na pesquisa.
 * @returns {string|null} Ex.: "jo%" vira "%jo\%%". null se o termo estiver vazio.
 */
function prepararTermoLike(termo) {
  const texto = String(termo || "").trim().toLowerCase();
  if (!texto) {
    return null;
  }
  return `%${texto.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`;
}

/**
 * Converte e valida um id vindo da URL (req.params.id chega sempre como texto).
 * @param {string} idTexto - Ex.: "15".
 * @returns {number|null} O id numérico, ou null se não for um inteiro positivo.
 */
function converterId(idTexto) {
  const id = Number(idTexto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Indica se um erro do SQLite é de violação de índice único (duplicidade).
 * @param {Error} erro
 * @returns {boolean}
 */
function ehErroDeDuplicidade(erro) {
  return /UNIQUE constraint failed/i.test(String(erro && erro.message));
}

module.exports = {
  lerPaginacao,
  montarRespostaPaginada,
  prepararTermoLike,
  converterId,
  ehErroDeDuplicidade
};
