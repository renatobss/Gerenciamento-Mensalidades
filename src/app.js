/**
 * CONFIGURAÇÃO DO APLICATIVO EXPRESS
 * ----------------------------------
 * Aqui montamos a "linha de produção" por onde cada requisição passa.
 * A ORDEM dos app.use() importa: o Express executa de cima para baixo e para
 * no primeiro trecho que enviar uma resposta.
 *
 *   1. Sessão e leitura de JSON       → prepara req.session e req.body
 *   2. Páginas de login               → públicas
 *   3. Rotas de autenticação (/api)   → públicas (login/logout)
 *   4. Proteção geral                 → daqui para baixo, só usuário logado
 *   5. Rotas da API protegidas
 *   6. Arquivos estáticos (public/)
 *   7. 404 da API e tratador de erros → sempre por último
 *
 * Por que separar app.js de server.js? O app.js só CONFIGURA; o server.js
 * LIGA o servidor (listen). Assim o app pode ser reaproveitado em testes
 * sem abrir uma porta de rede.
 */
const express = require("express");
const path = require("path");
const session = require("express-session");

const { segredoSessao, sessaoDuracaoHoras } = require("./config/ambiente");
const authRoutes = require("./routes/authRoutes");
const pagamentoRoutes = require("./routes/pagamentoRoutes");
const { protegerRecursos } = require("./middlewares/autenticacao");
const { rotaApiNaoEncontrada, tratadorErros } = require("./middlewares/tratadorErros");

const app = express();
const PASTA_PUBLICA = path.join(__dirname, "..", "public");

// 1. Sessão. O segredo vem do arquivo .env (src/config/ambiente.js).
app.use(session({
  secret: segredoSessao,
  resave: false,             // não regrava a sessão se nada mudou
  saveUninitialized: false,  // não cria sessão para quem ainda não logou
  rolling: true,             // cada requisição renova o prazo: expira só após X horas SEM uso
  cookie: {
    httpOnly: true,          // o JavaScript do navegador não consegue ler o cookie (protege contra XSS)
    sameSite: "lax",         // o cookie não é enviado em requisições vindas de outros sites (protege contra CSRF)
    secure: false,           // true exigiria HTTPS; em desenvolvimento usamos HTTP
    maxAge: sessaoDuracaoHoras * 60 * 60 * 1000 // em milissegundos
  }
}));

app.use(express.json()); // converte o corpo JSON da requisição em req.body

// 2. Tela de login: pública. Quem já está logado é levado direto ao sistema.
app.get(["/login", "/login.html"], (req, res) => {
  if (req.session.usuarioLogado) {
    return res.redirect("/");
  }
  return res.sendFile(path.join(PASTA_PUBLICA, "login.html"));
});

// 3. Login e logout: públicos (não dá para exigir login de quem vai logar).
app.use("/api", authRoutes);

// 4. A partir daqui, tudo exige usuário logado (exceto RECURSOS_PUBLICOS).
app.use(protegerRecursos);

// 5. API protegida.
app.use("/api/pagamentos", pagamentoRoutes);

// 6. Arquivos estáticos: index.html, app.js, styles.css...
app.use(express.static(PASTA_PUBLICA));

// 7. Tratamento de erros (sempre no final).
app.use("/api", rotaApiNaoEncontrada);
app.use(tratadorErros);

module.exports = app;
