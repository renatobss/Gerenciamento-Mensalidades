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
  },
  {
    versao: 2,
    descricao: "Cadastro de jogadores, vínculo com pagamentos e importação dos nomes existentes",
    executar(db) {
      // 1. Tabela de jogadores. CPF e telefone são guardados só com dígitos.
      db.exec(`
        CREATE TABLE jogadores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nome_completo TEXT NOT NULL,
          cpf TEXT,
          telefone TEXT,
          data_nascimento TEXT,
          data_entrada TEXT NOT NULL,
          valor_mensalidade REAL NOT NULL,
          ativo INTEGER NOT NULL DEFAULT 1,
          observacoes TEXT,
          criado_em TEXT NOT NULL DEFAULT (datetime('now')),
          atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- CPF único somente quando preenchido (índice parcial).
        CREATE UNIQUE INDEX idx_jogadores_cpf_unico ON jogadores (cpf) WHERE cpf IS NOT NULL;
        CREATE INDEX idx_jogadores_nome ON jogadores (lower(nome_completo));
      `);

      /**
       * 2. Vínculo pagamento → jogador (CHAVE ESTRANGEIRA).
       * REFERENCES jogadores(id) diz ao banco que jogador_id precisa apontar
       * para um jogador existente. A coluna antiga "jogador" (texto) é MANTIDA:
       * nada é apagado, e ela serve de histórico do nome no momento do pagamento.
       */
      db.exec(`
        ALTER TABLE pagamentos ADD COLUMN jogador_id INTEGER REFERENCES jogadores (id);
        CREATE INDEX idx_pagamentos_jogador ON pagamentos (jogador_id);
      `);

      /**
       * 3. Importação: cada nome distinto dos pagamentos vira um jogador.
       * - nome: a grafia usada no pagamento mais recente;
       * - data de entrada: data do PRIMEIRO pagamento;
       * - mensalidade: valor do pagamento MAIS RECENTE.
       * GROUP BY lower(trim(...)) junta "joao" e "Joao " como a mesma pessoa.
       * As subconsultas com ORDER BY ... LIMIT 1 pegam o registro mais recente.
       */
      db.exec(`
        INSERT INTO jogadores (nome_completo, data_entrada, valor_mensalidade, observacoes)
        SELECT
          (SELECT trim(p2.jogador) FROM pagamentos p2
            WHERE lower(trim(p2.jogador)) = lower(trim(p.jogador))
            ORDER BY p2.data_pagamento DESC, p2.id DESC LIMIT 1),
          MIN(p.data_pagamento),
          (SELECT p3.valor FROM pagamentos p3
            WHERE lower(trim(p3.jogador)) = lower(trim(p.jogador))
            ORDER BY p3.data_pagamento DESC, p3.id DESC LIMIT 1),
          'Cadastro criado automaticamente a partir dos pagamentos existentes.'
        FROM pagamentos p
        WHERE trim(p.jogador) <> ''
        GROUP BY lower(trim(p.jogador));
      `);

      // 4. Liga cada pagamento ao jogador importado com o mesmo nome.
      db.exec(`
        UPDATE pagamentos
        SET jogador_id = (
          SELECT j.id FROM jogadores j
          WHERE lower(trim(j.nome_completo)) = lower(trim(pagamentos.jogador))
        )
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
