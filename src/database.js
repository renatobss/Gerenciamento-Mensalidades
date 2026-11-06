const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");

const dataDirectory = path.join(__dirname, "..", "data");
const databasePath = path.join(dataDirectory, "mensalidades.db");

if (!fs.existsSync(dataDirectory)) {
  fs.mkdirSync(dataDirectory);
}

const db = new DatabaseSync(databasePath);

db.exec(`
  CREATE TABLE IF NOT EXISTS pagamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jogador TEXT NOT NULL,
    data_pagamento TEXT NOT NULL,
    valor REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pago',
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL
  )
`);

const inserirUsuarioPadrao = db.prepare("INSERT OR IGNORE INTO usuarios (nome, senha) VALUES (?, ?)");
inserirUsuarioPadrao.run("admin", "admin123");

module.exports = db;
