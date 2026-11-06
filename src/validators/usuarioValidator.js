/**
 * VALIDAÇÕES DE USUÁRIO
 * ---------------------
 * Confere e normaliza os dados de cadastro/edição de usuários.
 * As mesmas regras existem no frontend (para retorno rápido), mas são ESTAS
 * que garantem a integridade, pois a API pode ser chamada sem o frontend.
 *
 * Expressões regulares (regex) usadas:
 * - EMAIL:   algo@algo.algo  (validação simples; a confirmação real seria enviar um e-mail)
 * - USUARIO: 3 a 30 caracteres entre letras sem acento, números, ponto, hífen e sublinhado
 */
const { PERFIS_VALIDOS } = require("../config/perfis");

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_USUARIO = /^[a-zA-Z0-9._-]{3,30}$/;
const SENHA_MINIMO = 8;
const SENHA_MAXIMO = 128;

/**
 * Valida a força da senha.
 * @param {string} senha
 * @returns {string|null} Mensagem de erro, ou null se estiver tudo certo.
 */
function validarForcaSenha(senha) {
  if (senha.length < SENHA_MINIMO || senha.length > SENHA_MAXIMO) {
    return `A senha deve ter entre ${SENHA_MINIMO} e ${SENHA_MAXIMO} caracteres.`;
  }
  // /[a-zA-Z]/ = tem pelo menos uma letra; /\d/ = tem pelo menos um número.
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) {
    return "A senha deve conter letras e números.";
  }
  return null;
}

/**
 * Converte o campo "ativo" vindo do cliente em booleano.
 * Aceita true/false e também os textos "ativo"/"inativo" (valores do select da tela).
 * @param {unknown} valor
 * @returns {boolean|null} null quando o valor é inválido.
 */
function converterAtivo(valor) {
  if (valor === undefined) return true; // padrão no cadastro: ativo
  if (valor === true || valor === "ativo") return true;
  if (valor === false || valor === "inativo") return false;
  return null;
}

/**
 * Valida os dados de um usuário.
 *
 * @param {object} dados - Corpo da requisição.
 * @param {object} [opcoes]
 * @param {boolean} [opcoes.edicao=false] - Na edição a senha é opcional
 *   (em branco = manter a senha atual).
 * @returns {{ erros: string[], usuario: object }} "usuario" traz os dados normalizados.
 */
function validarUsuario(dados = {}, { edicao = false } = {}) {
  const erros = [];

  const nomeCompleto = String(dados.nomeCompleto || "").trim().replace(/\s+/g, " ");
  const email = String(dados.email || "").trim().toLowerCase();
  const usuario = String(dados.usuario || "").trim();
  const senha = typeof dados.senha === "string" ? dados.senha : "";
  const confirmarSenha = typeof dados.confirmarSenha === "string" ? dados.confirmarSenha : "";
  const perfil = String(dados.perfil || "").trim();
  const ativo = converterAtivo(dados.ativo);

  if (nomeCompleto.length < 3 || nomeCompleto.length > 100) {
    erros.push("Informe o nome completo (3 a 100 caracteres).");
  }

  if (!REGEX_EMAIL.test(email) || email.length > 150) {
    erros.push("Informe um e-mail válido.");
  }

  if (!REGEX_USUARIO.test(usuario)) {
    erros.push("O nome de usuário deve ter de 3 a 30 caracteres (letras, números, ponto, hífen ou sublinhado).");
  }

  // Senha: obrigatória no cadastro; na edição, só é validada se preenchida.
  const deveValidarSenha = !edicao || senha !== "" || confirmarSenha !== "";
  if (deveValidarSenha) {
    const erroSenha = senha ? validarForcaSenha(senha) : "Informe a senha.";
    if (erroSenha) {
      erros.push(erroSenha);
    } else if (senha !== confirmarSenha) {
      erros.push("A confirmação de senha não confere.");
    }
  }

  if (!PERFIS_VALIDOS.includes(perfil)) {
    erros.push("Selecione um perfil de acesso válido.");
  }

  if (ativo === null) {
    erros.push("Selecione uma situação válida.");
  }

  return {
    erros,
    usuario: {
      nomeCompleto,
      email,
      usuario,
      senha: deveValidarSenha ? senha : null, // null = não alterar a senha
      perfil,
      ativo
    }
  };
}

module.exports = { validarUsuario, validarForcaSenha };
