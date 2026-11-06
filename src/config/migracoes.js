/**
 * MIGRAÇÕES DO BANCO DE DADOS
 * ---------------------------
 * Uma MIGRAÇÃO é um passo numerado que evolui a estrutura do banco
 * (criar tabela, adicionar coluna, criar índice...) SEM perder os dados.
 *
 * Como o banco sabe quais migrações já rodaram?
 * O SQLite tem um contador interno chamado "PRAGMA user_version" (começa em 0).
 * Ao iniciar, executamos apenas as migrações com versão MAIOR que o contador
 * e atualizamos o contador. Assim, cada migração roda uma única vez por banco.
 *
 * Regras de ouro:
 * 1. Nunca altere uma migração que já foi executada. Crie uma nova.
 * 2. Prefira operações que só ACRESCENTAM (ADD COLUMN, CREATE INDEX...).
 * 3. Cada migração roda dentro de uma TRANSAÇÃO: se algo falhar no meio,
 *    tudo é desfeito (ROLLBACK) e o banco não fica pela metade.
 */

/**
 * Lista das migrações, em ordem.
 * @type {{ versao: number, descricao: string, executar: (db: import("node:sqlite").DatabaseSync) => void }[]}
 */
const MIGRACOES = [
  {
    versao: 1,
    descricao: "Cadastro de usuários: nome completo, e-mail, perfil e situação",
    executar(db) {
      // Novas colunas. A coluna "nome" já existente continua sendo o NOME DE USUÁRIO (login).
      // ADD COLUMN com NOT NULL exige um valor padrão para as linhas que já existem.
      db.exec(`
        ALTER TABLE usuarios ADD COLUMN nome_completo TEXT;
        ALTER TABLE usuarios ADD COLUMN email TEXT;
        ALTER TABLE usuarios ADD COLUMN perfil TEXT NOT NULL DEFAULT 'comum';
        ALTER TABLE usuarios ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE usuarios ADD COLUMN criado_em TEXT;
        ALTER TABLE usuarios ADD COLUMN atualizado_em TEXT;
      `);

      // Antes desta versão, todo usuário tinha acesso total. Para não tirar o
      // acesso de ninguém, os usuários existentes viram administradores.
      db.exec(`
        UPDATE usuarios
        SET perfil = 'admin', criado_em = datetime('now'), atualizado_em = datetime('now')
      `);

      /**
       * ÍNDICES ÚNICOS: a última barreira contra duplicidade, garantida pelo
       * próprio banco (mesmo que duas requisições cheguem ao mesmo tempo).
       * lower(...) faz "Joao" e "joao" serem considerados iguais.
       * "WHERE email IS NOT NULL" (índice parcial) permite vários usuários
       * antigos ainda sem e-mail.
       */
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_usuario_unico ON usuarios (lower(nome));
        CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unico ON usuarios (lower(email)) WHERE email IS NOT NULL;
      `);
    }
  }
];

/**
 * Executa as migrações pendentes.
 * @param {import("node:sqlite").DatabaseSync} db - Conexão com o banco.
 * @returns {number[]} Versões aplicadas nesta execução.
 */
function executarMigracoes(db) {
  const { user_version: versaoAtual } = db.prepare("PRAGMA user_version").get();
  const pendentes = MIGRACOES.filter((migracao) => migracao.versao > versaoAtual);

  for (const migracao of pendentes) {
    db.exec("BEGIN");
    try {
      migracao.executar(db);
      // PRAGMA não aceita parâmetros "?"; o valor vem do nosso código (seguro).
      db.exec(`PRAGMA user_version = ${Number(migracao.versao)}`);
      db.exec("COMMIT");
      console.log(`[MIGRAÇÃO] v${migracao.versao} aplicada: ${migracao.descricao}`);
    } catch (erro) {
      db.exec("ROLLBACK");
      throw new Error(`Falha na migração v${migracao.versao}: ${erro.message}`);
    }
  }

  return pendentes.map((migracao) => migracao.versao);
}

module.exports = { executarMigracoes };
