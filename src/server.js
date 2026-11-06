const express = require("express");
const path = require("path");
const session = require("express-session");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(session({
  secret: "minha_chave_secreta_gerenciamento_mensalidades_951",
  resave: false,
  saveUninitialized: false,
  cookie: {secure: false}
}));

app.use(express.json());

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "login.html"));
});

app.use(express.static(path.join(__dirname, "..", "public")));

function verificarAutenticacao(req, res, next) {
  if (req.session.usuarioLogado) {
    return next();
  }

  if (req.url.startsWith("/api/")) {
    return res.status(401).json({ erros: ["Nao autorizado. Faça login para continuar."] });
  }
  res.redirect("/login.html");
}

app.post("/api/login", (req, res) => {
  const { usuario, senha } = req.body;

  if (typeof usuario !== "string" || typeof senha !== "string") {
    return res.status(400).json({ erros: ["Usuario e senha sao obrigatorios."] });
  }

  try {
    const query = db.prepare("SELECT * FROM usuarios WHERE nome = ? AND senha = ?");
    const usuarioEncontrado = query.get(usuario, senha);

    if (usuarioEncontrado) {
      req.session.usuarioLogado = true;
      return res.status(200).json({ mensagem: "Login bem-sucedido." });
    } else {
      return res.status(401).json({ erros: ["Usuario ou senha invalidos."] });
    }
  } catch (error) {
    return res.status(500).json({ erros: ["Erro ao tentar fazer login."] });
  }
 
app.get("/api/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login.html");
});

app.use(express.static(path.join(__dirname, "..", "public", "public")));
  
});

function validarPagamento(dados) {
  const erros = [];
  const jogador = String(dados.jogador || "").trim();
  const dataPagamento = String(dados.data_pagamento || "").trim();
  const valor = Number(String(dados.valor || "").replace(",", "."));
  const status = String(dados.status || "Pago").trim();

  if (!jogador) {
    erros.push("Informe o nome do jogador.");
  }

  if (!dataPagamento || Number.isNaN(new Date(`${dataPagamento}T00:00:00`).getTime())) {
    erros.push("Informe uma data de pagamento valida.");
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    erros.push("Informe um valor maior que zero.");
  }

  if (!["Pago", "Pendente"].includes(status)) {
    erros.push("Escolha um status valido.");
  }

  return {
    erros,
    pagamento: {
      jogador,
      data_pagamento: dataPagamento,
      valor,
      status
    }
  };
}

app.get("/api/pagamentos", verificarAutenticacao, (req, res) => {
  const mes = String(req.query.mes || "").trim();

  let pagamentos;

  if (mes) {
    pagamentos = db.prepare(`
      SELECT id, jogador, data_pagamento, valor, status
      FROM pagamentos
      WHERE substr(data_pagamento, 1, 7) = ?
      ORDER BY data_pagamento DESC, id DESC
    `).all(mes);
  } else {
    pagamentos = db.prepare(`
      SELECT id, jogador, data_pagamento, valor, status
      FROM pagamentos
      ORDER BY data_pagamento DESC, id DESC
    `).all();
  }

  const totalPago = pagamentos
    .filter((pagamento) => pagamento.status === "Pago")
    .reduce((soma, pagamento) => soma + pagamento.valor, 0);

  const totalPendente = pagamentos
    .filter((pagamento) => pagamento.status === "Pendente")
    .reduce((soma, pagamento) => soma + pagamento.valor, 0);

  res.json({ pagamentos, totalPago, totalPendente });
});

app.post("/api/pagamentos", verificarAutenticacao, (req, res) => {
  const { erros, pagamento } = validarPagamento(req.body);

  if (erros.length > 0) {
    return res.status(400).json({ erros });
  }

  const resultado = db.prepare(`
    INSERT INTO pagamentos (jogador, data_pagamento, valor, status)
    VALUES (?, ?, ?, ?)
  `).run(
    pagamento.jogador,
    pagamento.data_pagamento,
    pagamento.valor,
    pagamento.status
  );

  const pagamentoCriado = db.prepare(`
    SELECT id, jogador, data_pagamento, valor, status
    FROM pagamentos
    WHERE id = ?
  `).get(resultado.lastInsertRowid);

  res.status(201).json(pagamentoCriado);
});

app.put("/api/pagamentos/:id", verificarAutenticacao, (req, res) => {
  const id = Number(req.params.id);
  const { erros, pagamento } = validarPagamento(req.body);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erros: ["ID invalido."] });
  }

  if (erros.length > 0) {
    return res.status(400).json({ erros });
  }

  const resultado = db.prepare(`
    UPDATE pagamentos
    SET jogador = ?, data_pagamento = ?, valor = ?, status = ?
    WHERE id = ?
  `).run(
    pagamento.jogador,
    pagamento.data_pagamento,
    pagamento.valor,
    pagamento.status,
    id
  );

  if (resultado.changes === 0) {
    return res.status(404).json({ erros: ["Pagamento nao encontrado."] });
  }

  const pagamentoAtualizado = db.prepare(`
    SELECT id, jogador, data_pagamento, valor, status
    FROM pagamentos
    WHERE id = ?
  `).get(id);

  res.json(pagamentoAtualizado);
});

app.delete("/api/pagamentos/:id", verificarAutenticacao, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ erros: ["ID invalido."] });
  }

  const resultado = db.prepare("DELETE FROM pagamentos WHERE id = ?").run(id);

  if (resultado.changes === 0) {
    return res.status(404).json({ erros: ["Pagamento nao encontrado."] });
  }

  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
