/**
 * MIDDLEWARES DE AUTENTICAÇÃO
 * ---------------------------
 * Middleware é uma função (req, res, next) que roda ANTES da rota final.
 * Ela pode:
 *   - deixar passar: chamando next();
 *   - barrar: respondendo direto (res.status(401)... ou res.redirect(...)).
 *
 * Funciona como uma "catraca" na entrada do estádio: só passa quem tem ingresso.
 */
const usuarioService = require("../services/usuarioService");

/**
 * Arquivos que qualquer pessoa pode acessar sem estar logada.
 * Estratégia "negar por padrão" (default deny): tudo é protegido, EXCETO o que
 * está nesta lista. É mais seguro do que listar o que proteger, porque uma
 * página nova já nasce protegida, mesmo que alguém esqueça de configurar.
 */
const RECURSOS_PUBLICOS = ["/login.js", "/styles.css", "/favicon.ico"];

/**
 * Responde "não autenticado" do jeito certo para cada tipo de requisição:
 * - API (/api/...): 401 em JSON, pois quem chama é o JavaScript (fetch);
 * - Páginas: redireciona para a tela de login.
 */
function responderNaoAutenticado(req, res) {
  // originalUrl mantém o caminho completo mesmo dentro de um Router.
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ erros: ["Nao autorizado. Faça login para continuar."] });
  }
  return res.redirect("/login.html");
}

/**
 * Verifica se existe um usuário logado e ATIVO.
 *
 * A sessão guarda apenas o id do usuário. A cada requisição, buscamos os dados
 * atualizados no banco e colocamos em req.usuario. Vantagens:
 * - um usuário inativado perde o acesso NA HORA (não precisa esperar a sessão expirar);
 * - uma mudança de perfil vale imediatamente.
 * O custo é uma consulta rápida por requisição, irrelevante neste sistema.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function exigirAutenticacao(req, res, next) {
  // Se outro middleware já validou nesta mesma requisição, não repete a consulta.
  if (req.usuario) {
    return next();
  }

  const usuarioId = req.session && req.session.usuarioId;
  const usuario = usuarioId ? usuarioService.buscarAtivoParaSessao(usuarioId) : null;

  if (!usuario) {
    // Sessão de usuário removido/inativado: encerramos a sessão antiga.
    if (usuarioId) {
      return req.session.destroy(() => responderNaoAutenticado(req, res));
    }
    return responderNaoAutenticado(req, res);
  }

  req.usuario = usuario; // disponível para os próximos middlewares e controllers
  return next();
}

/**
 * Protege todos os arquivos estáticos (páginas, scripts) exceto os públicos.
 * Deve ser registrado ANTES do express.static em src/app.js; a ordem dos
 * app.use() define a ordem de execução.
 */
function protegerRecursos(req, res, next) {
  if (RECURSOS_PUBLICOS.includes(req.path)) {
    return next();
  }

  return exigirAutenticacao(req, res, next);
}

module.exports = { exigirAutenticacao, protegerRecursos };
