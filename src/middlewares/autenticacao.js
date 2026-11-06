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

/**
 * Arquivos que qualquer pessoa pode acessar sem estar logada.
 * Estratégia "negar por padrão" (default deny): tudo é protegido, EXCETO o que
 * está nesta lista. É mais seguro do que listar o que proteger, porque uma
 * página nova já nasce protegida, mesmo que alguém esqueça de configurar.
 */
const RECURSOS_PUBLICOS = ["/login.js", "/styles.css", "/favicon.ico"];

/**
 * Verifica se existe um usuário logado na sessão.
 * - Requisições de API (/api/...) recebem 401 em JSON, pois quem chama é o
 *   JavaScript (fetch) e ele precisa de uma resposta que consiga interpretar.
 * - Páginas recebem um redirecionamento para a tela de login.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
function exigirAutenticacao(req, res, next) {
  if (req.session && req.session.usuarioLogado) {
    return next();
  }

  // originalUrl mantém o caminho completo mesmo dentro de um Router.
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(401).json({ erros: ["Nao autorizado. Faça login para continuar."] });
  }

  return res.redirect("/login.html");
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
