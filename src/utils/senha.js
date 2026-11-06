/**
 * HASH DE SENHAS (crypto.scrypt, nativo do Node)
 * ----------------------------------------------
 * NUNCA guardamos a senha em si. Guardamos um HASH: o resultado de uma função
 * matemática de mão única. Dá para calcular o hash a partir da senha, mas não
 * dá para voltar do hash para a senha.
 *
 * No login, calculamos o hash da senha digitada e comparamos com o salvo.
 *
 * Conceitos importantes:
 * - SALT: um valor aleatório diferente para cada senha. Assim, duas pessoas com
 *   a senha "123456" terão hashes DIFERENTES, e tabelas prontas de hashes
 *   ("rainbow tables") deixam de funcionar.
 * - FUNÇÃO LENTA DE PROPÓSITO: o scrypt gasta CPU e memória. Para o usuário,
 *   alguns milissegundos não fazem diferença. Para um atacante tentando
 *   bilhões de senhas, faz toda a diferença.
 * - COMPARAÇÃO EM TEMPO CONSTANTE (timingSafeEqual): uma comparação comum (===)
 *   para no primeiro caractere diferente, e medir esse tempo pode vazar
 *   informação. A comparação em tempo constante sempre leva o mesmo tempo.
 *
 * Formato salvo no banco (tudo em um único texto):
 *   scrypt$N$r$p$<salt em base64>$<hash em base64>
 * Guardar os parâmetros junto permite aumentar a segurança no futuro sem
 * invalidar as senhas antigas.
 */
const crypto = require("crypto");
const { promisify } = require("util");

// promisify transforma a função de callback crypto.scrypt em uma que devolve
// Promise, o que permite usar "await".
const scryptAsync = promisify(crypto.scrypt);

const PREFIXO = "scrypt";
const PARAMETROS = { N: 16384, r: 8, p: 1 }; // custo de CPU/memória recomendado
const TAMANHO_SALT = 16; // bytes
const TAMANHO_HASH = 64; // bytes

/**
 * Gera o hash de uma senha.
 * @param {string} senha - Senha em texto puro.
 * @returns {Promise<string>} Texto no formato scrypt$N$r$p$salt$hash.
 */
async function gerarHash(senha) {
  const salt = crypto.randomBytes(TAMANHO_SALT);
  const hash = await scryptAsync(senha, salt, TAMANHO_HASH, PARAMETROS);
  const { N, r, p } = PARAMETROS;

  return [PREFIXO, N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

/**
 * Confere se uma senha corresponde a um hash salvo.
 * @param {string} senha - Senha digitada.
 * @param {string} hashSalvo - Valor guardado no banco.
 * @returns {Promise<boolean>} true se a senha estiver correta.
 */
async function verificarSenha(senha, hashSalvo) {
  if (!ehHash(hashSalvo)) {
    return false;
  }

  const [, N, r, p, saltBase64, hashBase64] = hashSalvo.split("$");
  const hashEsperado = Buffer.from(hashBase64, "base64");

  const hashCalculado = await scryptAsync(
    senha,
    Buffer.from(saltBase64, "base64"),
    hashEsperado.length,
    { N: Number(N), r: Number(r), p: Number(p) }
  );

  return crypto.timingSafeEqual(hashCalculado, hashEsperado);
}

/**
 * Indica se um valor já está no formato de hash deste módulo.
 * Usado na migração de senhas antigas que estavam em texto puro.
 * @param {unknown} valor
 * @returns {boolean}
 */
function ehHash(valor) {
  return typeof valor === "string" && valor.startsWith(`${PREFIXO}$`) && valor.split("$").length === 6;
}

module.exports = { gerarHash, verificarSenha, ehHash };
