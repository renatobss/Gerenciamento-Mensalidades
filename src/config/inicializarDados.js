/**
 * INICIALIZAÇÃO DOS DADOS
 * -----------------------
 * Executado UMA vez, quando o servidor sobe (veja src/server.js), antes de
 * aceitar requisições. Faz duas tarefas seguras e repetíveis ("idempotentes":
 * rodar 1 ou 100 vezes dá o mesmo resultado):
 *
 * 1. MIGRAÇÃO: converte senhas antigas em texto puro para hash scrypt.
 *    O usuário continua entrando com a MESMA senha; só a forma de guardar muda.
 * 2. USUÁRIO INICIAL: se não houver nenhum usuário, cria o "admin".
 *    (Antes, o admin/admin123 era recriado em toda inicialização.)
 */
const db = require("./database");
const { adminSenhaInicial } = require("./ambiente");
const { gerarHash, ehHash } = require("../utils/senha");
const { PERFIS } = require("./perfis");

/**
 * Converte para hash todas as senhas que ainda estão em texto puro.
 * @returns {Promise<number>} Quantidade de senhas migradas.
 */
async function migrarSenhasEmTextoPuro() {
  const usuarios = db.prepare("SELECT id, senha FROM usuarios").all();
  const atualizar = db.prepare("UPDATE usuarios SET senha = ? WHERE id = ?");
  let migradas = 0;

  for (const usuario of usuarios) {
    if (!ehHash(usuario.senha)) {
      atualizar.run(await gerarHash(usuario.senha), usuario.id);
      migradas++;
    }
  }

  return migradas;
}

/**
 * Cria o usuário "admin" somente se a tabela de usuários estiver vazia.
 * @returns {Promise<boolean>} true se o admin foi criado.
 */
async function criarAdminInicialSeNecessario() {
  const { total } = db.prepare("SELECT COUNT(*) AS total FROM usuarios").get();

  if (total > 0) {
    return false;
  }

  db.prepare(`
    INSERT INTO usuarios (nome, senha, nome_completo, perfil, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).run("admin", await gerarHash(adminSenhaInicial), "Administrador", PERFIS.ADMIN);
  return true;
}

/**
 * Executa todas as tarefas de inicialização e mostra o resultado no console.
 * @returns {Promise<void>}
 */
async function inicializarDados() {
  const migradas = await migrarSenhasEmTextoPuro();
  if (migradas > 0) {
    console.log(`[INICIALIZAÇÃO] ${migradas} senha(s) em texto puro convertida(s) para hash.`);
  }

  if (await criarAdminInicialSeNecessario()) {
    console.log('[INICIALIZAÇÃO] Usuário "admin" criado. Troque a senha inicial assim que possível.');
  }
}

module.exports = { inicializarDados };
