/**
 * SERVICE DE AUTENTICAÇÃO
 * -----------------------
 * Responsabilidade: decidir se as credenciais são válidas.
 *
 * Camadas de proteção aplicadas aqui:
 * 1. Validação de entrada: tipos, campos obrigatórios e tamanho máximo.
 * 2. Limite de tentativas: bloqueia temporariamente após várias falhas.
 * 3. Senha comparada por HASH (scrypt), nunca em texto puro.
 * 4. Mensagem genérica: não revela se o erro foi no usuário ou na senha.
 * 5. Tempo de resposta parecido para usuário existente e inexistente.
 */
const db = require("../config/database");
const { loginMaxTentativas, loginBloqueioMinutos } = require("../config/ambiente");
const AppError = require("../utils/AppError");
const LimitadorTentativas = require("../utils/LimitadorTentativas");
const { gerarHash, verificarSenha } = require("../utils/senha");

const TAMANHO_MAXIMO_USUARIO = 100;
const TAMANHO_MAXIMO_SENHA = 128; // evita que senhas gigantes sobrecarreguem o scrypt

const limitador = new LimitadorTentativas({
  maxTentativas: loginMaxTentativas,
  bloqueioMs: loginBloqueioMinutos * 60 * 1000
});

/**
 * Hash "falso" usado quando o usuário não existe.
 *
 * Por quê? Se o usuário não existe e respondermos na hora, mas para um usuário
 * existente gastarmos tempo calculando o scrypt, um atacante pode medir o
 * tempo de resposta e descobrir quais usuários existem (ataque de "timing").
 * Comparando sempre com ALGUM hash, o tempo fica parecido nos dois casos.
 *
 * Conceito: a Promise é criada uma única vez e reaproveitada (memoização).
 */
let hashFalsoPromise;
function obterHashFalso() {
  hashFalsoPromise = hashFalsoPromise || gerarHash("usuario-inexistente");
  return hashFalsoPromise;
}

/**
 * Autentica um usuário.
 *
 * @param {unknown} usuario - Nome de usuário digitado.
 * @param {unknown} senha - Senha digitada.
 * @param {string} ip - IP de quem está tentando (para o limite de tentativas).
 * @returns {Promise<{ id: number, nome: string }>} Dados públicos do usuário (SEM a senha).
 * @throws {AppError} 400 (dados inválidos), 401 (credenciais inválidas) ou
 *   429 (muitas tentativas; "Too Many Requests").
 */
async function autenticar(usuario, senha, ip) {
  // typeof garante que chegou texto (e não número, objeto, array...).
  if (typeof usuario !== "string" || typeof senha !== "string" || !usuario.trim() || !senha) {
    throw new AppError("Usuario e senha sao obrigatorios.", 400);
  }

  if (usuario.length > TAMANHO_MAXIMO_USUARIO || senha.length > TAMANHO_MAXIMO_SENHA) {
    throw new AppError("Usuário ou senha excedem o tamanho permitido.", 400);
  }

  const nomeUsuario = usuario.trim();
  const chave = `${ip}|${nomeUsuario.toLowerCase()}`;

  const restanteMs = limitador.tempoRestanteBloqueio(chave);
  if (restanteMs > 0) {
    const minutos = Math.ceil(restanteMs / 60000);
    throw new AppError(
      `Muitas tentativas de login sem sucesso. Tente novamente em ${minutos} minuto(s).`,
      429
    );
  }

  // Aqui PRECISAMOS ler o hash para compará-lo, mas ele nunca sai desta função.
  const registro = db
    .prepare("SELECT id, nome, senha FROM usuarios WHERE nome = ?")
    .get(nomeUsuario);

  const hashParaComparar = registro ? registro.senha : await obterHashFalso();
  const senhaConfere = await verificarSenha(senha, hashParaComparar);

  if (!registro || !senhaConfere) {
    limitador.registrarFalha(chave);
    throw new AppError("Usuario ou senha invalidos.", 401);
  }

  limitador.limpar(chave);

  // Devolvemos só os dados públicos: o hash da senha NUNCA sai do service.
  return { id: registro.id, nome: registro.nome };
}

module.exports = { autenticar };
