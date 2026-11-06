/**
 * MIDDLEWARE DE AUTORIZAÇÃO (controle por perfil)
 * -----------------------------------------------
 * Autenticação ≠ Autorização:
 * - AUTENTICAÇÃO: confirmar QUEM é o usuário (login). Falha → 401 Unauthorized.
 * - AUTORIZAÇÃO: decidir O QUE ele pode fazer (perfil). Falha → 403 Forbidden.
 *
 * Esconder um botão no frontend NÃO é segurança: qualquer pessoa pode chamar a
 * API direto. Por isso a verificação de perfil acontece AQUI, no backend.
 */

/**
 * Cria um middleware que só deixa passar usuários com um dos perfis informados.
 *
 * Conceito: FUNÇÃO QUE CRIA FUNÇÃO (factory). exigirPerfil("admin") devolve um
 * middleware "configurado" para o perfil admin. Assim reaproveitamos a mesma
 * lógica para qualquer perfil.
 *
 * Deve ser usado DEPOIS de exigirAutenticacao, que preenche req.usuario.
 *
 * @param {...string} perfisPermitidos - Ex.: exigirPerfil("admin")
 * @returns {import("express").RequestHandler}
 */
function exigirPerfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (req.usuario && perfisPermitidos.includes(req.usuario.perfil)) {
      return next();
    }

    if (req.originalUrl.startsWith("/api/")) {
      return res.status(403).json({ erros: ["Você não tem permissão para realizar esta ação."] });
    }

    // Página proibida: volta para a tela inicial em vez de mostrar um erro técnico.
    return res.redirect("/");
  };
}

module.exports = { exigirPerfil };
