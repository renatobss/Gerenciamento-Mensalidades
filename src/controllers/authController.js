/**
 * CONTROLLER DE AUTENTICAÇÃO
 * --------------------------
 * Responsabilidade: login (criar a sessão), logout (destruir a sessão) e
 * informar quem está logado.
 *
 * Como funciona a SESSÃO (express-session):
 * - Após o login, o servidor guarda dados em req.session (na memória do servidor).
 * - O navegador recebe apenas um cookie "connect.sid" com um identificador
 *   aleatório e assinado. Em cada requisição o navegador reenvia o cookie e o
 *   servidor encontra a sessão correspondente.
 * - Ou seja: os dados do usuário nunca ficam no navegador, só o identificador.
 */
const authService = require("../services/authService");

/**
 * POST /api/login
 * Corpo esperado: { "usuario": "admin", "senha": "..." }
 * Respostas: 200 (sucesso), 400 (dados inválidos), 401 (credenciais inválidas),
 * 403 (usuário inativo), 429 (bloqueado por excesso de tentativas).
 *
 * Função "async" porque a verificação do hash (scrypt) é assíncrona.
 * Os erros lançados pelo service chegam ao tratadorErros via capturarErros.
 */
async function login(req, res) {
  const { usuario, senha } = req.body || {};
  const usuarioAutenticado = await authService.autenticar(usuario, senha, req.ip);

  /**
   * regenerate() cria uma sessão NOVA (novo identificador) no momento do login.
   * Isso evita o ataque "session fixation", em que alguém força a vítima a usar
   * um identificador de sessão conhecido e depois aproveita o login dela.
   */
  req.session.regenerate((erro) => {
    if (erro) {
      return res.status(500).json({ erros: ["Erro ao tentar fazer login."] });
    }

    // Guardamos só o ID. Os demais dados (perfil, situação) são lidos do banco
    // a cada requisição pelo middleware exigirAutenticacao, sempre atualizados.
    req.session.usuarioId = usuarioAutenticado.id;

    return res.status(200).json({ mensagem: "Login bem-sucedido.", usuario: usuarioAutenticado });
  });
}

/**
 * GET /api/logout
 * Destrói a sessão no servidor, apaga o cookie e volta para o login.
 */
function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login.html");
  });
}

/**
 * GET /api/sessao (protegida)
 * Devolve os dados públicos do usuário logado (req.usuario, preenchido pelo
 * middleware). O frontend usa isso para mostrar o nome no menu e exibir
 * somente as opções permitidas para o perfil.
 */
function sessaoAtual(req, res) {
  res.json({ usuario: req.usuario });
}

module.exports = { login, logout, sessaoAtual };
