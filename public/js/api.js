/**
 * CLIENTE DA API (frontend)
 * -------------------------
 * Centraliza TODAS as chamadas HTTP do frontend em uma única função.
 * Vantagens:
 *   - o tratamento de sessão expirada (401) e de falha de rede fica em um lugar só;
 *   - as telas recebem os dados prontos ou um erro padronizado (ErroApi);
 *   - se a API mudar (ex.: um cabeçalho novo), ajustamos só aqui.
 *
 * Conceito: MÓDULOS ES (import/export). Este arquivo é carregado com
 * <script type="module">, então cada arquivo tem seu próprio escopo e só
 * compartilha o que exporta (nada de variáveis globais soltas).
 */

/**
 * Erro padronizado das chamadas à API.
 * Conceito: HERANÇA de Error, como o AppError do backend.
 */
export class ErroApi extends Error {
  /**
   * @param {number} status - Status HTTP (0 = falha de rede).
   * @param {string[]} erros - Mensagens para exibir ao usuário.
   */
  constructor(status, erros) {
    super(erros.join(" "));
    this.name = "ErroApi";
    this.status = status;
    this.erros = erros;
  }
}

/**
 * Faz uma requisição à API e devolve o JSON da resposta.
 *
 * @param {string} url - Ex.: "/api/usuarios?pagina=2".
 * @param {object} [opcoes]
 * @param {string} [opcoes.metodo="GET"] - GET, POST, PUT, PATCH, DELETE.
 * @param {object} [opcoes.corpo] - Objeto que será enviado como JSON.
 * @returns {Promise<any>} Dados da resposta (null para 204 No Content).
 * @throws {ErroApi} Em qualquer resposta de erro ou falha de rede.
 *
 * @example
 * const lista = await api("/api/usuarios");
 * await api("/api/usuarios", { metodo: "POST", corpo: { nomeCompleto: "..." } });
 */
export async function api(url, { metodo = "GET", corpo } = {}) {
  const opcoesFetch = { method: metodo, headers: {} };

  if (corpo !== undefined) {
    opcoesFetch.headers["Content-Type"] = "application/json";
    opcoesFetch.body = JSON.stringify(corpo);
  }

  let resposta;
  try {
    resposta = await fetch(url, opcoesFetch);
  } catch {
    // fetch só lança exceção em falha de REDE (servidor fora do ar, sem internet).
    throw new ErroApi(0, ["Não foi possível conectar ao servidor. Verifique sua conexão."]);
  }

  // Sessão expirada ou inexistente: volta para o login com aviso.
  if (resposta.status === 401) {
    window.location.href = "/login.html?sessao=expirada";
    // Promise que nunca resolve: a página vai mudar, então nada mais deve rodar.
    return new Promise(() => {});
  }

  if (resposta.status === 204) {
    return null;
  }

  // .catch(() => ({})) evita quebrar se o servidor responder algo que não é JSON.
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    const erros = Array.isArray(dados.erros) && dados.erros.length
      ? dados.erros
      : ["Ocorreu um erro inesperado. Tente novamente."];
    throw new ErroApi(resposta.status, erros);
  }

  return dados;
}
