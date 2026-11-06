/**
 * SERVICE DE USUÁRIOS
 * -------------------
 * Regras de negócio do cadastro de usuários.
 *
 * Regras implementadas:
 * - E-mail e nome de usuário não podem se repetir (sem diferenciar maiúsculas).
 * - A senha é salva somente como hash e NUNCA é devolvida pela API.
 * - Não existe exclusão: usuários são INATIVADOS, preservando o histórico.
 * - O administrador não pode inativar a si mesmo nem remover o próprio perfil
 *   de administrador (evita ficar trancado para fora do sistema).
 * - O sistema sempre precisa ter ao menos um administrador ativo.
 *
 * Observação sobre o banco: a coluna "nome" guarda o NOME DE USUÁRIO (login).
 * Ela foi mantida com esse nome por compatibilidade com a versão anterior; na
 * API ela aparece como "usuario".
 */
const db = require("../config/database");
const AppError = require("../utils/AppError");
const { gerarHash } = require("../utils/senha");
const { PERFIS } = require("../config/perfis");
const { validarUsuario } = require("../validators/usuarioValidator");
const {
  lerPaginacao,
  montarRespostaPaginada,
  prepararTermoLike,
  converterId,
  ehErroDeDuplicidade
} = require("../utils/consultas");

/**
 * Colunas PÚBLICAS do usuário. A coluna "senha" fica de fora de propósito:
 * se ela nunca é selecionada, não há como vazar por engano em uma resposta.
 * "AS" renomeia a coluna no resultado (snake_case do banco → camelCase do JS).
 */
const COLUNAS_PUBLICAS = `
  id,
  nome_completo AS nomeCompleto,
  email,
  nome AS usuario,
  perfil,
  ativo,
  criado_em AS criadoEm,
  atualizado_em AS atualizadoEm
`;

/**
 * Converte a linha do banco no formato da API.
 * O SQLite não tem tipo booleano: guarda 1/0. Aqui convertemos para true/false.
 * @param {object|undefined} linha
 * @returns {object|null}
 */
function paraApi(linha) {
  return linha ? { ...linha, ativo: linha.ativo === 1 } : null;
}

/**
 * Busca um usuário pelo id (dados públicos).
 * @param {number} id
 * @returns {object|null}
 */
function buscarPorId(id) {
  return paraApi(db.prepare(`SELECT ${COLUNAS_PUBLICAS} FROM usuarios WHERE id = ?`).get(id));
}

/**
 * Busca o usuário da sessão, somente se ainda estiver ATIVO.
 * Usado pelo middleware de autenticação a cada requisição: assim, se um admin
 * inativar alguém ou mudar seu perfil, a mudança vale imediatamente.
 * @param {number} id
 * @returns {object|null}
 */
function buscarAtivoParaSessao(id) {
  const usuario = buscarPorId(id);
  return usuario && usuario.ativo ? usuario : null;
}

/**
 * Converte o id da URL e garante que o usuário exista.
 * @param {string} idTexto
 * @returns {object} O usuário encontrado.
 * @throws {AppError} 400 (id inválido) ou 404 (não encontrado).
 */
function obterExistente(idTexto) {
  const id = converterId(idTexto);
  if (!id) {
    throw new AppError("ID inválido.", 400);
  }

  const usuario = buscarPorId(id);
  if (!usuario) {
    throw new AppError("Usuário não encontrado.", 404);
  }
  return usuario;
}

/**
 * Lista usuários com pesquisa, filtro de situação e paginação.
 *
 * @param {object} query - req.query: { busca, status: "ativo"|"inativo"|"todos", pagina, limite }
 * @returns {object} Resposta paginada: { itens, total, pagina, limite, totalPaginas }
 */
function listar(query = {}) {
  const paginacao = lerPaginacao(query);
  const condicoes = [];
  const parametros = [];

  // Montamos o WHERE aos poucos, só com os filtros informados.
  // Os VALORES sempre vão em "parametros" (nunca concatenados no SQL).
  const termo = prepararTermoLike(query.busca);
  if (termo) {
    condicoes.push(`(
      lower(coalesce(nome_completo, '')) LIKE ? ESCAPE '\\'
      OR lower(coalesce(email, '')) LIKE ? ESCAPE '\\'
      OR lower(nome) LIKE ? ESCAPE '\\'
    )`);
    parametros.push(termo, termo, termo);
  }

  const status = String(query.status || "todos");
  if (status === "ativo" || status === "inativo") {
    condicoes.push("ativo = ?");
    parametros.push(status === "ativo" ? 1 : 0);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";

  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM usuarios ${where}`).get(...parametros);

  const itens = db.prepare(`
    SELECT ${COLUNAS_PUBLICAS}
    FROM usuarios
    ${where}
    ORDER BY ativo DESC, lower(coalesce(nome_completo, nome))
    LIMIT ? OFFSET ?
  `).all(...parametros, paginacao.limite, paginacao.offset);

  return montarRespostaPaginada(itens.map(paraApi), total, paginacao);
}

/**
 * Verifica se e-mail ou nome de usuário já pertencem a OUTRO usuário.
 * @param {{ email: string, usuario: string }} dados
 * @param {number} [idIgnorado] - Na edição, o próprio usuário não conta.
 * @throws {AppError} 409 (Conflict) se houver duplicidade.
 */
function garantirSemDuplicidade({ email, usuario }, idIgnorado = 0) {
  const erros = [];

  if (db.prepare("SELECT 1 FROM usuarios WHERE lower(email) = lower(?) AND id <> ?").get(email, idIgnorado)) {
    erros.push("Este e-mail já está cadastrado para outro usuário.");
  }
  if (db.prepare("SELECT 1 FROM usuarios WHERE lower(nome) = lower(?) AND id <> ?").get(usuario, idIgnorado)) {
    erros.push("Este nome de usuário já está em uso.");
  }

  if (erros.length) {
    throw new AppError(erros, 409);
  }
}

/**
 * Conta administradores ativos, sem considerar um usuário específico.
 * @param {number} idIgnorado
 * @returns {number}
 */
function contarOutrosAdminsAtivos(idIgnorado) {
  return db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE perfil = ? AND ativo = 1 AND id <> ?")
    .get(PERFIS.ADMIN, idIgnorado).total;
}

/**
 * Garante que a alteração não deixe o sistema sem administrador ativo, e que o
 * usuário logado não tire o próprio acesso.
 *
 * @param {object} atual - Usuário como está no banco.
 * @param {{ perfil: string, ativo: boolean }} novo - Como ficará.
 * @param {number} idLogado - Id de quem está fazendo a alteração.
 * @throws {AppError} 400 se a regra for violada.
 */
function garantirAdministracaoPreservada(atual, novo, idLogado) {
  const deixaDeSerAdminAtivo = atual.perfil === PERFIS.ADMIN && atual.ativo
    && (novo.perfil !== PERFIS.ADMIN || !novo.ativo);

  if (!deixaDeSerAdminAtivo) {
    return;
  }

  if (atual.id === idLogado) {
    throw new AppError("Você não pode inativar o próprio usuário nem remover o seu perfil de administrador.", 400);
  }

  if (contarOutrosAdminsAtivos(atual.id) === 0) {
    throw new AppError("O sistema precisa ter pelo menos um administrador ativo.", 400);
  }
}

/**
 * Executa uma escrita no banco convertendo violações de índice único em 409.
 * Isso cobre o caso raro de duas requisições simultâneas passarem pela
 * verificação de duplicidade ao mesmo tempo.
 * @param {Function} escrita
 * @returns {*} O retorno da função escrita.
 */
function executarComTratamentoDeDuplicidade(escrita) {
  try {
    return escrita();
  } catch (erro) {
    if (ehErroDeDuplicidade(erro)) {
      throw new AppError("E-mail ou nome de usuário já cadastrado.", 409);
    }
    throw erro;
  }
}

/**
 * Cadastra um usuário.
 * @param {object} dados - Corpo da requisição.
 * @returns {Promise<object>} Usuário criado (sem senha).
 * @throws {AppError} 400 (dados inválidos) ou 409 (duplicidade).
 */
async function criar(dados) {
  const { erros, usuario } = validarUsuario(dados);
  if (erros.length) {
    throw new AppError(erros, 400);
  }

  garantirSemDuplicidade(usuario);
  const hash = await gerarHash(usuario.senha);

  const resultado = executarComTratamentoDeDuplicidade(() => db.prepare(`
    INSERT INTO usuarios (nome_completo, email, nome, senha, perfil, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(usuario.nomeCompleto, usuario.email, usuario.usuario, hash, usuario.perfil, usuario.ativo ? 1 : 0));

  return buscarPorId(resultado.lastInsertRowid);
}

/**
 * Atualiza um usuário. Senha em branco = mantém a senha atual.
 * @param {string} idTexto - Id da URL.
 * @param {object} dados - Corpo da requisição.
 * @param {number} idLogado - Id do administrador que está editando.
 * @returns {Promise<object>} Usuário atualizado (sem senha).
 * @throws {AppError} 400, 404 ou 409.
 */
async function atualizar(idTexto, dados, idLogado) {
  const atual = obterExistente(idTexto);

  const { erros, usuario } = validarUsuario(dados, { edicao: true });
  if (erros.length) {
    throw new AppError(erros, 400);
  }

  garantirSemDuplicidade(usuario, atual.id);
  garantirAdministracaoPreservada(atual, usuario, idLogado);

  // Só recalculamos o hash se uma nova senha foi informada.
  const novoHash = usuario.senha ? await gerarHash(usuario.senha) : null;

  executarComTratamentoDeDuplicidade(() => db.prepare(`
    UPDATE usuarios
    SET nome_completo = ?, email = ?, nome = ?, perfil = ?, ativo = ?,
        senha = coalesce(?, senha),
        atualizado_em = datetime('now')
    WHERE id = ?
  `).run(
    usuario.nomeCompleto, usuario.email, usuario.usuario, usuario.perfil, usuario.ativo ? 1 : 0,
    novoHash, // coalesce(NULL, senha) mantém a senha atual quando não há nova
    atual.id
  ));

  return buscarPorId(atual.id);
}

/**
 * Inativa um usuário (exclusão LÓGICA: o registro continua no banco).
 * @param {string} idTexto - Id da URL.
 * @param {number} idLogado - Id do administrador.
 * @returns {object} Usuário inativado.
 * @throws {AppError} 400 ou 404.
 */
function inativar(idTexto, idLogado) {
  const atual = obterExistente(idTexto);
  garantirAdministracaoPreservada(atual, { perfil: atual.perfil, ativo: false }, idLogado);

  db.prepare("UPDATE usuarios SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(atual.id);
  return buscarPorId(atual.id);
}

module.exports = {
  listar,
  buscarPorId,
  buscarAtivoParaSessao,
  obterExistente,
  criar,
  atualizar,
  inativar
};
