/**
 * SERVICE DE AUTENTICAÇÃO
 * -----------------------
 * Responsabilidade: verificar se usuário e senha conferem.
 *
 * Etapa 1: a lógica foi apenas movida de lugar, sem mudar o comportamento.
 * Etapa 2 (próxima): a senha passará a ser comparada por HASH (crypto.scrypt),
 * nunca mais em texto puro.
 */
const db = require("../config/database");
const AppError = require("../utils/AppError");

/**
 * Autentica um usuário.
 *
 * @param {unknown} usuario - Nome de usuário digitado.
 * @param {unknown} senha - Senha digitada.
 * @returns {{ id: number, nome: string }} Dados públicos do usuário (SEM a senha).
 * @throws {AppError} 400 se faltar usuário/senha; 401 se as credenciais forem inválidas.
 */
function autenticar(usuario, senha) {
  // typeof garante que chegou texto (e não número, objeto, array...).
  if (typeof usuario !== "string" || typeof senha !== "string" || !usuario || !senha) {
    throw new AppError("Usuario e senha sao obrigatorios.", 400);
  }

  // Selecionamos apenas id e nome: a senha nunca sai desta consulta.
  const usuarioEncontrado = db
    .prepare("SELECT id, nome FROM usuarios WHERE nome = ? AND senha = ?")
    .get(usuario, senha);

  // Mensagem genérica de propósito: não revelamos se o erro foi no usuário
  // ou na senha (isso ajudaria um atacante a descobrir usuários válidos).
  if (!usuarioEncontrado) {
    throw new AppError("Usuario ou senha invalidos.", 401);
  }

  return usuarioEncontrado;
}

module.exports = { autenticar };
