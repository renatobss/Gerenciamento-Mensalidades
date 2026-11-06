/**
 * CONTROLLER DE AUTENTICAÇÃO
 * --------------------------
 * Responsabilidade: login (criar a sessão) e logout (destruir a sessão).
 *
 * Como funciona a SESSÃO (express-session):
 * - Após o login, o servidor guarda dados em req.session (na memória do servidor).
 * - O navegador recebe apenas um cookie "connect.sid" com um identificador
 *   aleatório. Em cada requisição o navegador reenvia o cookie e o servidor
 *   encontra a sessão correspondente.
 * - Ou seja: os dados do usuário nunca ficam no navegador, só o identificador.
 */
const authService = require("../services/authService");

/**
 * POST /api/login
 * Corpo esperado: { "usuario": "admin", "senha": "..." }
 * Respostas: 200 (sucesso), 400 (campos faltando), 401 (credenciais inválidas).
 */
function login(req, res) {
  const { usuario, senha } = req.body || {};
  const usuarioAutenticado = authService.autenticar(usuario, senha);

  /**
   * regenerate() cria uma sessão NOVA (novo identificador) no momento do login.
   * Isso evita o ataque "session fixation", em que alguém força a vítima a usar
   * um identificador de sessão conhecido e depois aproveita o login dela.
   */
  req.session.regenerate((erro) => {
    if (erro) {
      return res.status(500).json({ erros: ["Erro ao tentar fazer login."] });
    }

    // Mantido por compatibilidade com a verificação atual.
    req.session.usuarioLogado = true;
    // Novo: guardamos quem é o usuário. Será a base do controle de perfis.
    req.session.usuario = usuarioAutenticado;

    return res.status(200).json({ mensagem: "Login bem-sucedido." });
  });
}

/**
 * GET /api/logout
 * Destrói a sessão no servidor, apaga o cookie e volta para o login.
 * (Antes desta etapa, esta rota nunca era registrada por causa de um bug.)
 */
function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login.html");
  });
}

module.exports = { login, logout };
