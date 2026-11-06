/**
 * CONEXÃO COM O BANCO DE DADOS (SQLite)
 * -------------------------------------
 * Responsabilidade: abrir o arquivo do banco, criar as tabelas que ainda não
 * existem e exportar a conexão para o resto do sistema.
 *
 * Por que SQLite? Ele grava tudo em um único arquivo (data/mensalidades.db) e
 * vem embutido no Node 24 (módulo "node:sqlite"), então não é preciso instalar
 * nenhum servidor de banco.
 *
 * Por que a conexão fica em um módulo separado? Em Node, um módulo é executado
 * uma única vez e o resultado fica em cache. Assim, todo arquivo que fizer
 * require("../config/database") recebe a MESMA conexão (padrão Singleton).
 */
require("./ambiente"); // garante que o .env já foi lido (DB_PATH pode estar lá)
const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { executarMigracoes } = require("./migracoes");

// Caminho padrão do banco: <raiz do projeto>/data/mensalidades.db
const caminhoPadrao = path.join(__dirname, "..", "..", "data", "mensalidades.db");

/**
 * A variável de ambiente DB_PATH permite apontar para OUTRO arquivo de banco.
 * Isso é muito útil em testes automatizados (Cypress, por exemplo): os testes
 * rodam em um banco descartável e nunca sujam os dados reais.
 * Exemplo (PowerShell): $env:DB_PATH="data/teste.db"; npm start
 */
const databasePath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : caminhoPadrao;

// Garante que a pasta do banco exista (recursive evita erro se já existir).
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

// DatabaseSync = API síncrona: cada consulta bloqueia até terminar.
// Para uma aplicação pequena isso simplifica muito o código (sem async/await).
const db = new DatabaseSync(databasePath);

// "CREATE TABLE IF NOT EXISTS" só cria a tabela na primeira execução.
// Nas próximas, o comando é ignorado e os dados existentes são preservados.
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

// A coluna "senha" guarda o HASH da senha, nunca o texto digitado.
// O usuário inicial e a migração de senhas antigas ficam em
// src/config/inicializarDados.js (precisam de código assíncrono).

// Evolui a estrutura do banco (novas colunas, tabelas e índices).
// Veja src/config/migracoes.js.
executarMigracoes(db);

module.exports = db;
