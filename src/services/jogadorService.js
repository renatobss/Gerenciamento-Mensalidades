/**
 * SERVICE DE JOGADORES
 * --------------------
 * Regras de negócio do cadastro de jogadores.
 *
 * Regras implementadas:
 * - CPF é opcional, mas quando informado precisa ser válido e único.
 * - Sem CPF, consideramos DUPLICADO quem tiver o mesmo nome e a mesma data de
 *   nascimento de outro jogador (a melhor identificação disponível).
 * - Não existe exclusão: jogadores são INATIVADOS. Os pagamentos ligados a
 *   eles continuam intactos (integridade do histórico financeiro). A chave
 *   estrangeira pagamentos.jogador_id também impediria uma exclusão física.
 * - Jogador inativo não recebe novos pagamentos (regra em pagamentoService).
 */
const db = require("../config/database");
const AppError = require("../utils/AppError");
const { validarJogador } = require("../validators/jogadorValidator");
const {
  lerPaginacao,
  montarRespostaPaginada,
  prepararTermoLike,
  converterId,
  ehErroDeDuplicidade
} = require("../utils/consultas");
const { apenasDigitos } = require("../utils/validacoes");

/**
 * Colunas devolvidas pela API (snake_case do banco → camelCase do JavaScript).
 * "totalPendente" é calculado por uma SUBCONSULTA: para cada jogador, soma os
 * pagamentos pendentes dele. Cancelados não entram na conta.
 */
const COLUNAS = `
  j.id,
  j.nome_completo AS nomeCompleto,
  j.cpf,
  j.telefone,
  j.data_nascimento AS dataNascimento,
  j.data_entrada AS dataEntrada,
  j.valor_mensalidade AS valorMensalidade,
  j.ativo,
  j.observacoes,
  j.criado_em AS criadoEm,
  j.atualizado_em AS atualizadoEm,
  (SELECT coalesce(sum(p.valor), 0) FROM pagamentos p
    WHERE p.jogador_id = j.id AND p.status = 'Pendente') AS totalPendente
`;

/**
 * Converte a linha do banco para o formato da API (ativo 1/0 → true/false).
 * @param {object|undefined} linha
 * @returns {object|null}
 */
function paraApi(linha) {
  return linha ? { ...linha, ativo: linha.ativo === 1 } : null;
}

/**
 * Busca um jogador pelo id.
 * @param {number} id
 * @returns {object|null}
 */
function buscarPorId(id) {
  return paraApi(db.prepare(`SELECT ${COLUNAS} FROM jogadores j WHERE j.id = ?`).get(id));
}

/**
 * Converte o id da URL e garante que o jogador exista.
 * @param {string|number} idTexto
 * @returns {object}
 * @throws {AppError} 400 (id inválido) ou 404 (não encontrado).
 */
function obterExistente(idTexto) {
  const id = converterId(idTexto);
  if (!id) {
    throw new AppError("ID inválido.", 400);
  }
  const jogador = buscarPorId(id);
  if (!jogador) {
    throw new AppError("Jogador não encontrado.", 404);
  }
  return jogador;
}

/**
 * Lista jogadores com pesquisa (nome ou CPF), filtro de situação e paginação.
 * @param {object} query - req.query: { busca, status, pagina, limite }
 * @returns {object} { itens, total, pagina, limite, totalPaginas }
 */
function listar(query = {}) {
  const paginacao = lerPaginacao(query);
  const condicoes = [];
  const parametros = [];

  const termo = prepararTermoLike(query.busca);
  if (termo) {
    const digitos = apenasDigitos(query.busca);
    if (digitos.length >= 3) {
      // Se digitou números, procura também no CPF.
      condicoes.push("(lower(j.nome_completo) LIKE ? ESCAPE '\\' OR j.cpf LIKE ?)");
      parametros.push(termo, `%${digitos}%`);
    } else {
      condicoes.push("lower(j.nome_completo) LIKE ? ESCAPE '\\'");
      parametros.push(termo);
    }
  }

  const status = String(query.status || "todos");
  if (status === "ativo" || status === "inativo") {
    condicoes.push("j.ativo = ?");
    parametros.push(status === "ativo" ? 1 : 0);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM jogadores j ${where}`).get(...parametros);

  const itens = db.prepare(`
    SELECT ${COLUNAS}
    FROM jogadores j
    ${where}
    ORDER BY j.ativo DESC, lower(j.nome_completo)
    LIMIT ? OFFSET ?
  `).all(...parametros, paginacao.limite, paginacao.offset);

  return montarRespostaPaginada(itens.map(paraApi), total, paginacao);
}

/**
 * Lista enxuta de jogadores, sem paginação, para preencher selects.
 * - Formulário de pagamento: só ATIVOS (padrão).
 * - Filtro da listagem: todos (incluirInativos = true), para consultar o histórico.
 * CPF e data de entrada ajudam a diferenciar jogadores com o mesmo nome.
 *
 * @param {boolean} [incluirInativos=false]
 * @returns {object[]}
 */
function listarOpcoes(incluirInativos = false) {
  return db.prepare(`
    SELECT id, nome_completo AS nomeCompleto, valor_mensalidade AS valorMensalidade,
           cpf, data_entrada AS dataEntrada, ativo
    FROM jogadores
    ${incluirInativos ? "" : "WHERE ativo = 1"}
    ORDER BY lower(nome_completo)
  `).all().map(paraApi);
}

/**
 * Impede cadastro duplicado.
 * @param {object} jogador - Dados normalizados.
 * @param {number} [idIgnorado=0] - Na edição, o próprio jogador não conta.
 * @throws {AppError} 409 (Conflict).
 */
function garantirSemDuplicidade(jogador, idIgnorado = 0) {
  if (jogador.cpf
    && db.prepare("SELECT 1 FROM jogadores WHERE cpf = ? AND id <> ?").get(jogador.cpf, idIgnorado)) {
    throw new AppError("Já existe um jogador cadastrado com este CPF.", 409);
  }

  // coalesce(x, '') trata "sem data" como texto vazio, para comparar nulos como iguais.
  const mesmoNomeENascimento = db.prepare(`
    SELECT 1 FROM jogadores
    WHERE lower(nome_completo) = lower(?)
      AND coalesce(data_nascimento, '') = coalesce(?, '')
      AND id <> ?
  `).get(jogador.nomeCompleto, jogador.dataNascimento, idIgnorado);

  if (mesmoNomeENascimento) {
    throw new AppError("Já existe um jogador com este nome e data de nascimento.", 409);
  }
}

/**
 * Executa uma escrita convertendo violação de índice único (CPF) em 409.
 * @param {Function} escrita
 * @returns {*}
 */
function executarComTratamentoDeDuplicidade(escrita) {
  try {
    return escrita();
  } catch (erro) {
    if (ehErroDeDuplicidade(erro)) {
      throw new AppError("Já existe um jogador cadastrado com este CPF.", 409);
    }
    throw erro;
  }
}

/**
 * Valida os dados e lança 400 se houver erros.
 * @param {object} dados
 * @returns {object} Jogador normalizado.
 */
function validarOuFalhar(dados) {
  const { erros, jogador } = validarJogador(dados);
  if (erros.length) {
    throw new AppError(erros, 400);
  }
  return jogador;
}

/**
 * Cadastra um jogador.
 * @param {object} dados
 * @returns {object} Jogador criado.
 * @throws {AppError} 400 ou 409.
 */
function criar(dados) {
  const jogador = validarOuFalhar(dados);
  garantirSemDuplicidade(jogador);

  const resultado = executarComTratamentoDeDuplicidade(() => db.prepare(`
    INSERT INTO jogadores
      (nome_completo, cpf, telefone, data_nascimento, data_entrada, valor_mensalidade, ativo, observacoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jogador.nomeCompleto, jogador.cpf, jogador.telefone, jogador.dataNascimento,
    jogador.dataEntrada, jogador.valorMensalidade, jogador.ativo ? 1 : 0, jogador.observacoes
  ));

  return buscarPorId(resultado.lastInsertRowid);
}

/**
 * Atualiza um jogador.
 * @param {string} idTexto
 * @param {object} dados
 * @returns {object} Jogador atualizado.
 * @throws {AppError} 400, 404 ou 409.
 */
function atualizar(idTexto, dados) {
  const atual = obterExistente(idTexto);
  const jogador = validarOuFalhar(dados);
  garantirSemDuplicidade(jogador, atual.id);

  executarComTratamentoDeDuplicidade(() => db.prepare(`
    UPDATE jogadores
    SET nome_completo = ?, cpf = ?, telefone = ?, data_nascimento = ?, data_entrada = ?,
        valor_mensalidade = ?, ativo = ?, observacoes = ?, atualizado_em = datetime('now')
    WHERE id = ?
  `).run(
    jogador.nomeCompleto, jogador.cpf, jogador.telefone, jogador.dataNascimento, jogador.dataEntrada,
    jogador.valorMensalidade, jogador.ativo ? 1 : 0, jogador.observacoes, atual.id
  ));

  return buscarPorId(atual.id);
}

/**
 * Inativa um jogador (exclusão LÓGICA). Os pagamentos dele são preservados.
 * @param {string} idTexto
 * @returns {object} Jogador inativado.
 */
function inativar(idTexto) {
  const atual = obterExistente(idTexto);
  db.prepare("UPDATE jogadores SET ativo = 0, atualizado_em = datetime('now') WHERE id = ?").run(atual.id);
  return buscarPorId(atual.id);
}

module.exports = { listar, listarOpcoes, buscarPorId, obterExistente, criar, atualizar, inativar };
