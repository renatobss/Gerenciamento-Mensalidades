/**
 * TELA DE JOGADORES (frontend)
 * ----------------------------
 * Mesma organização da tela de usuários (js/usuarios.js):
 *   listagem (pesquisa, filtro, paginação) → modal de cadastro/edição → inativação.
 *
 * Diferenças importantes:
 *   - máscaras de CPF, telefone e valor (js/mascaras.js);
 *   - CPF validado pelos dígitos verificadores já no navegador;
 *   - a coluna "Pendente" mostra quanto o jogador deve (calculado no backend).
 */
import { api, ErroApi } from "./api.js";
import { mostrarToast, confirmar, definirErroCampo, definirCarregando, debounce } from "./ui.js";
import {
  formatarCpf, formatarTelefone, formatarValorDigitado, converterValor, valorParaCampo,
  moeda, formatarData, hojeIso, validarCpf, apenasDigitos, aplicarMascara
} from "./mascaras.js";

// ---------- Elementos da tela ----------
const corpoTabela = document.getElementById("corpoTabelaJogadores");
const semJogadores = document.getElementById("semJogadores");
const campoPesquisa = document.getElementById("pesquisaJogador");
const filtroStatus = document.getElementById("filtroStatusJogador");
const infoPaginacao = document.getElementById("infoPaginacao");
const btnAnterior = document.getElementById("btnPaginaAnterior");
const btnProxima = document.getElementById("btnProximaPagina");

const modal = document.getElementById("modalJogador");
const form = document.getElementById("formJogador");
const tituloModal = document.getElementById("tituloModalJogador");
const erroFormulario = document.getElementById("erroFormularioJogador");
const btnSalvar = document.getElementById("btnSalvarJogador");

const campos = {
  nomeCompleto: document.getElementById("nomeJogador"),
  cpf: document.getElementById("cpf"),
  telefone: document.getElementById("telefone"),
  dataNascimento: document.getElementById("dataNascimento"),
  dataEntrada: document.getElementById("dataEntrada"),
  valorMensalidade: document.getElementById("valorMensalidade"),
  ativo: document.getElementById("statusJogador"),
  observacoes: document.getElementById("observacoes")
};

/** Estado da tela (o que, ao mudar, exige redesenho). */
const estado = { pagina: 1, totalPaginas: 1, jogadorEmEdicao: null };

// ---------- Listagem ----------

/** Busca a página atual de jogadores aplicando pesquisa e filtro. */
async function carregarJogadores() {
  const parametros = new URLSearchParams({
    busca: campoPesquisa.value.trim(),
    status: filtroStatus.value,
    pagina: String(estado.pagina),
    limite: "10"
  });

  try {
    const resposta = await api(`/api/jogadores?${parametros}`);

    if (resposta.itens.length === 0 && estado.pagina > 1) {
      estado.pagina = resposta.totalPaginas;
      return carregarJogadores();
    }

    estado.totalPaginas = resposta.totalPaginas;
    renderizarTabela(resposta.itens);
    infoPaginacao.textContent = `${resposta.total} jogador(es) · Página ${resposta.pagina} de ${resposta.totalPaginas}`;
    btnAnterior.disabled = resposta.pagina <= 1;
    btnProxima.disabled = resposta.pagina >= resposta.totalPaginas;
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao carregar jogadores.", "erro");
  }
}

/**
 * Cria uma célula com texto seguro (textContent) e rótulo para o layout mobile.
 * @param {string} rotulo
 * @param {string|Node} conteudo
 * @returns {HTMLTableCellElement}
 */
function criarCelula(rotulo, conteudo) {
  const td = document.createElement("td");
  td.dataset.rotulo = rotulo;
  if (conteudo instanceof Node) td.appendChild(conteudo);
  else td.textContent = conteudo;
  return td;
}

/**
 * Cria um elemento simples com classe, texto e data-test.
 * @returns {HTMLElement}
 */
function criarElemento(tag, classe, texto, dataTest) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto;
  if (dataTest) el.dataset.test = dataTest;
  return el;
}

/**
 * Cria um botão de ação da linha.
 * @returns {HTMLButtonElement}
 */
function criarBotao(texto, classes, dataTest, aoClicar) {
  const botao = criarElemento("button", `btn btn-pequeno ${classes}`, texto, dataTest);
  botao.type = "button";
  botao.addEventListener("click", aoClicar);
  return botao;
}

/**
 * Desenha as linhas da tabela.
 * Cada linha: data-test="linha-jogador" e data-id com o id do jogador.
 * @param {object[]} jogadores
 */
function renderizarTabela(jogadores) {
  corpoTabela.replaceChildren();
  semJogadores.hidden = jogadores.length > 0;

  for (const jogador of jogadores) {
    const tr = criarElemento("tr", "", undefined, "linha-jogador");
    tr.dataset.id = String(jogador.id);

    // Nome + CPF (em texto menor) na mesma célula.
    const nome = document.createElement("div");
    nome.append(criarElemento("div", "", jogador.nomeCompleto, "nome-jogador"));
    if (jogador.cpf) nome.append(criarElemento("div", "texto-secundario", formatarCpf(jogador.cpf)));

    const pendente = criarElemento(
      "span",
      jogador.totalPendente > 0 ? "texto-alerta" : "texto-secundario",
      jogador.totalPendente > 0 ? moeda.format(jogador.totalPendente) : "—",
      "pendente-jogador"
    );

    const acoes = criarElemento("div", "acoes-tabela");
    acoes.append(criarBotao("Editar", "btn-secundario", "btn-editar-jogador", () => abrirModal(jogador)));
    if (jogador.ativo) {
      acoes.append(criarBotao("Inativar", "btn-contorno-perigo", "btn-inativar-jogador", () => inativarJogador(jogador)));
    }

    tr.append(
      criarCelula("Nome", nome),
      criarCelula("Telefone", jogador.telefone ? formatarTelefone(jogador.telefone) : "—"),
      criarCelula("Entrada", formatarData(jogador.dataEntrada)),
      criarCelula("Mensalidade", moeda.format(jogador.valorMensalidade)),
      criarCelula("Pendente", pendente),
      criarCelula("Situação", criarElemento(
        "span",
        `etiqueta etiqueta-${jogador.ativo ? "ativo" : "inativo"}`,
        jogador.ativo ? "Ativo" : "Inativo",
        "status-jogador"
      )),
      criarCelula("Ações", acoes)
    );
    corpoTabela.appendChild(tr);
  }
}

// ---------- Formulário ----------

/** Limpa os erros de todos os campos e o erro geral. */
function limparErros() {
  Object.values(campos).forEach((campo) => definirErroCampo(campo));
  erroFormulario.hidden = true;
}

/**
 * Abre o modal: sem argumento = cadastro; com jogador = edição.
 * @param {object|null} [jogador=null]
 */
function abrirModal(jogador = null) {
  estado.jogadorEmEdicao = jogador;
  form.reset();
  limparErros();
  tituloModal.textContent = jogador ? "Editar jogador" : "Novo jogador";

  // O atributo max impede escolher datas futuras no calendário do navegador.
  campos.dataNascimento.max = hojeIso();

  if (jogador) {
    campos.nomeCompleto.value = jogador.nomeCompleto;
    campos.cpf.value = jogador.cpf ? formatarCpf(jogador.cpf) : "";
    campos.telefone.value = jogador.telefone ? formatarTelefone(jogador.telefone) : "";
    campos.dataNascimento.value = jogador.dataNascimento || "";
    campos.dataEntrada.value = jogador.dataEntrada;
    campos.valorMensalidade.value = valorParaCampo(jogador.valorMensalidade);
    campos.ativo.value = jogador.ativo ? "ativo" : "inativo";
    campos.observacoes.value = jogador.observacoes || "";
  } else {
    campos.dataEntrada.value = hojeIso(); // sugestão: entrou hoje
  }

  modal.showModal();
  campos.nomeCompleto.focus();
}

/**
 * Lê o formulário no formato da API. CPF e telefone vão só com dígitos.
 * @returns {object}
 */
function lerFormulario() {
  return {
    nomeCompleto: campos.nomeCompleto.value.trim(),
    cpf: apenasDigitos(campos.cpf.value),
    telefone: apenasDigitos(campos.telefone.value),
    dataNascimento: campos.dataNascimento.value,
    dataEntrada: campos.dataEntrada.value,
    valorMensalidade: campos.valorMensalidade.value,
    ativo: campos.ativo.value,
    observacoes: campos.observacoes.value.trim()
  };
}

/**
 * Validação no navegador (espelha as regras do backend).
 * @param {object} dados
 * @returns {boolean}
 */
function validarFormulario(dados) {
  const erros = {};
  const hoje = hojeIso();

  if (dados.nomeCompleto.length < 3) erros.nomeCompleto = "Informe o nome completo (mínimo 3 caracteres).";
  if (dados.cpf && !validarCpf(dados.cpf)) erros.cpf = "CPF inválido. Confira os números.";
  if (dados.telefone && !/^\d{10,11}$/.test(dados.telefone)) erros.telefone = "Informe DDD + número.";
  if (dados.dataNascimento && dados.dataNascimento > hoje) {
    erros.dataNascimento = "A data de nascimento não pode ser no futuro.";
  }
  if (!dados.dataEntrada) {
    erros.dataEntrada = "Informe a data de entrada no grupo.";
  } else if (dados.dataNascimento && dados.dataEntrada < dados.dataNascimento) {
    erros.dataEntrada = "A entrada não pode ser antes do nascimento.";
  }
  const valor = converterValor(dados.valorMensalidade);
  if (!Number.isFinite(valor) || valor <= 0) erros.valorMensalidade = "Informe um valor maior que zero.";

  Object.entries(campos).forEach(([nome, campo]) => definirErroCampo(campo, erros[nome]));

  const primeiro = Object.keys(erros)[0];
  if (primeiro) campos[primeiro].focus();
  return !primeiro;
}

/**
 * Envia o formulário: POST (cadastro) ou PUT (edição).
 * @param {SubmitEvent} evento
 */
async function salvarJogador(evento) {
  evento.preventDefault();
  limparErros();

  const dados = lerFormulario();
  if (!validarFormulario(dados)) return;

  const edicao = Boolean(estado.jogadorEmEdicao);
  const url = edicao ? `/api/jogadores/${estado.jogadorEmEdicao.id}` : "/api/jogadores";

  definirCarregando(btnSalvar, true);
  try {
    await api(url, { metodo: edicao ? "PUT" : "POST", corpo: dados });
    modal.close();
    mostrarToast(edicao ? "Jogador atualizado com sucesso." : "Jogador cadastrado com sucesso.");
    await carregarJogadores();
  } catch (erro) {
    erroFormulario.textContent = erro instanceof ErroApi ? erro.erros.join(" ") : "Erro ao salvar jogador.";
    erroFormulario.hidden = false;
  } finally {
    definirCarregando(btnSalvar, false);
  }
}

/**
 * Inativa um jogador após confirmação. Os pagamentos dele são preservados.
 * @param {object} jogador
 */
async function inativarJogador(jogador) {
  const confirmou = await confirmar({
    titulo: "Inativar jogador",
    mensagem: `Deseja inativar "${jogador.nomeCompleto}"? O histórico de pagamentos será mantido, mas ele não poderá receber novos lançamentos.`,
    textoConfirmar: "Inativar"
  });
  if (!confirmou) return;

  try {
    await api(`/api/jogadores/${jogador.id}/inativar`, { metodo: "PATCH" });
    mostrarToast("Jogador inativado com sucesso.");
    await carregarJogadores();
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao inativar jogador.", "erro");
  }
}

// ---------- Eventos ----------
aplicarMascara(campos.cpf, formatarCpf);
aplicarMascara(campos.telefone, formatarTelefone);
aplicarMascara(campos.valorMensalidade, formatarValorDigitado);

document.getElementById("btnNovoJogador").addEventListener("click", () => abrirModal());
document.getElementById("btnCancelarJogador").addEventListener("click", () => modal.close());
form.addEventListener("submit", salvarJogador);

Object.values(campos).forEach((campo) => {
  campo.addEventListener("input", () => definirErroCampo(campo));
});

campoPesquisa.addEventListener("input", debounce(() => {
  estado.pagina = 1;
  carregarJogadores();
}));

filtroStatus.addEventListener("change", () => {
  estado.pagina = 1;
  carregarJogadores();
});

btnAnterior.addEventListener("click", () => {
  estado.pagina = Math.max(1, estado.pagina - 1);
  carregarJogadores();
});

btnProxima.addEventListener("click", () => {
  estado.pagina = Math.min(estado.totalPaginas, estado.pagina + 1);
  carregarJogadores();
});

carregarJogadores();
