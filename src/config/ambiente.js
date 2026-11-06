/**
 * CONFIGURAÇÕES DE AMBIENTE (.env)
 * --------------------------------
 * Informações sensíveis (como o segredo da sessão) ou que mudam conforme o
 * ambiente (porta, caminho do banco) NÃO devem ficar escritas no código.
 * Se ficassem, qualquer pessoa com acesso ao repositório Git as veria.
 *
 * Solução: o arquivo ".env" na raiz do projeto, que fica fora do Git (veja o
 * .gitignore). O ".env.example" é o "modelo" versionado, sem valores reais.
 *
 * process.loadEnvFile() é nativo do Node (20.12+): lê o .env e coloca cada
 * linha CHAVE=valor em process.env.CHAVE. Por isso não precisamos instalar a
 * biblioteca "dotenv".
 *
 * Este módulo é carregado UMA vez (cache de módulos do Node) e exporta as
 * configurações já convertidas e com valores padrão.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const arquivoEnv = path.join(__dirname, "..", "..", ".env");

if (fs.existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

/**
 * Converte uma variável de ambiente em número inteiro positivo.
 * @param {string|undefined} valor - Texto vindo do process.env.
 * @param {number} padrao - Valor usado se a variável não existir ou for inválida.
 * @returns {number}
 */
function lerInteiro(valor, padrao) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : padrao;
}

/**
 * Segredo usado para ASSINAR o cookie da sessão. Com ele, o servidor percebe
 * se alguém tentou falsificar o cookie. Se não estiver configurado, geramos um
 * aleatório: o sistema funciona, mas todos são deslogados a cada reinício.
 */
let segredoSessao = process.env.SESSION_SECRET;

if (!segredoSessao) {
  segredoSessao = crypto.randomBytes(32).toString("hex");
  console.warn(
    "[AVISO] SESSION_SECRET não definido no .env. Usando um segredo temporário " +
    "(as sessões serão perdidas ao reiniciar o servidor)."
  );
}

module.exports = {
  porta: lerInteiro(process.env.PORT, 3001),
  segredoSessao,
  // Senha do administrador criado automaticamente quando o banco está vazio.
  adminSenhaInicial: process.env.ADMIN_SENHA_INICIAL || "admin123",
  // Proteção contra força bruta: N falhas seguidas bloqueiam por X minutos.
  loginMaxTentativas: lerInteiro(process.env.LOGIN_MAX_TENTATIVAS, 5),
  loginBloqueioMinutos: lerInteiro(process.env.LOGIN_BLOQUEIO_MINUTOS, 15),
  // Tempo de vida da sessão sem uso (em horas).
  sessaoDuracaoHoras: lerInteiro(process.env.SESSAO_DURACAO_HORAS, 8)
};
