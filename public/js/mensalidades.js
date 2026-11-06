/**
 * TELA DE MENSALIDADES (frontend)
 * -------------------------------
 * Substitui o antigo public/app.js, agora no mesmo padrão das outras telas:
 * módulos ES, cliente de API único, modal, toasts, filtros e paginação.
 *
 * Funcionalidades:
 *   - filtros por mês, jogador e status (todos combináveis);
 *   - resumo (pago/pendente/quantidade) sempre de acordo com os filtros;
 *   - lançar e editar pagamento em um modal;
 *   - cancelamento lógico (o pagamento continua no histórico);
 *   - atalho vindo do painel: /mensalidades.html?novo=1&jogador=ID
 *     abre o modal com o jogador já escolhido.
 */
import { api, ErroApi } from "./api.js";
import { mostrarToast, confirmar, definirErroCampo, definirCarregando } from "./ui.js";
import {
  moeda, formatarData, hojeIso, formatarValorDigitado, converterValor, valorParaCampo, aplicarMascara
} from "./mascaras.js";

// ---------- Elementos ----------
const filtroMes = document.getElementById("filtroMes");
const filtroJogador = document.getElementById("filtroJogador");
const filtroStatus = document.getElementById("filtroStatus");
const corpoTabela = document.getElementById("corpoTabelaPagamentos");
const semPagamentos = document.getElementById("semPagamentos");
const infoPaginacao = document.getElementById("infoPaginacao");
const btnAnterior = document.getElementById("btnPaginaAnterior");
const btnProxima = document.getElementById("btnProximaPagina");

const modal = document.getElementById("modalPagamento");
const form = document.getElementById("formPagamento");
const tituloModal = document.getElementById("tituloModalPagamento");
const erroFormulario = document.getElementById("erroFormularioPagamento");
const btnSalvar = document.getElementById("btnSalvarPagamento");

const campos = {
  jogador_id: document.getElementById("jogadorPagamento"),
  data_pagamento: document.getElementById("dataPagamento"),
  valor: document.getElementById("valorPagamento"),
  status: document.getElementById("statusPagamento")
};

/** Estado da tela. */
const estado = {
  pagina: 1,
  totalPaginas: 1,
  pagamentoEmEdicao: null,
  /** @type {object[]} todos os jogadores (ativos e inativos), para o filtro e para rótulos */
  jogadores: []
};

// ---------- Jogadores (selects) ----------

/**
 * Monta o texto da opção de um jogador. Se houver outro jogador com o MESMO
 * nome, acrescenta a data de entrada para diferenciá-los.
 * @param {object} jogador
 * @returns {string}
 */
function rotuloJogador(jogador) {
  const homonimo = estado.jogadores.some(
    (outro) => outro.id !== jogador.id && outro.nomeCompleto.toLowerCase() === jogador.nomeCompleto.toLowerCase()
  );
  let rotulo = jogador.nomeCompleto;
  if (homonimo) rotulo += ` · desde ${formatarData(jogador.dataEntrada)}`;
  if (!jogador.ativo) rotulo += " (inativo)";
  return rotulo;
}

/**
 * Preenche um <select> com jogadores (mantendo a primeira opção, o "placeholder").
 * @param {HTMLSelectElement} select
 * @param {object[]} jogadores
 */
function preencherSelect(select, jogadores) {
  select.length = 1;
  for (const jogador of jogadores) {
    const opcao = document.createElement("option");
    opcao.value = String(jogador.id);
    opcao.textContent = rotuloJogador(jogador); // textContent: seguro contra XSS
    select.appendChild(opcao);
  }
}

/** Carrega todos os jogadores uma vez e preenche os dois selects. */
async function carregarJogadores() {
  estado.jogadores = await api("/api/jogadores/opcoes?incluirInativos=1");
  preencherSelect(filtroJogador, estado.jogadores);                         // filtro: todos
  preencherSelect(campos.jogador_id, estado.jogadores.filter((j) => j.ativo)); // lançamento: só ativos
}

// ---------- Listagem ----------

/** Monta a query string a partir dos filtros e da página atual. */
function montarParametros() {
  const parametros = new URLSearchParams({ pagina: String(estado.pagina), limite: "10" });
  if (filtroMes.value) parametros.set("mes", filtroMes.value);
  if (filtroJogador.value) parametros.set("jogador_id", filtroJogador.value);
  if (filtroStatus.value) parametros.set("status", filtroStatus.value);
  return parametros;
}

/** Busca os pagamentos com os filtros aplicados e redesenha tabela e resumo. */
async function carregarPagamentos() {
  try {
    const dados = await api(`/api/pagamentos?${montarParametros()}`);

    if (dados.pagamentos.length === 0 && estado.pagina > 1) {
      estado.pagina = dados.totalPaginas;
      return carregarPagamentos();
    }

    estado.totalPaginas = dados.totalPaginas;
    document.getElementById("totalPago").textContent = moeda.format(dados.totalPago);
    document.getElementById("totalPendente").textContent = moeda.format(dados.totalPendente);
    document.getElementById("quantidadePagamentos").textContent = String(dados.total);

    renderizarTabela(dados.pagamentos);
    infoPaginacao.textContent = `${dados.total} lançamento(s) · Página ${dados.pagina} de ${dados.totalPaginas}`;
    btnAnterior.disabled = dados.pagina <= 1;
    btnProxima.disabled = dados.pagina >= dados.totalPaginas;
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao carregar pagamentos.", "erro");
  }
}

/**
 * Cria uma célula com rótulo para o layout mobile.
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
 * Cria um botão de ação da linha.
 * @returns {HTMLButtonElement}
 */
function criarBotao(texto, classes, dataTest, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = `btn btn-pequeno ${classes}`;
  botao.dataset.test = dataTest;
  botao.textContent = texto;
  botao.addEventListener("click", aoClicar);
  return botao;
}

/**
 * Desenha as linhas. Pagamentos cancelados ficam sem ações (só histórico).
 * Cada linha: data-test="linha-pagamento" e data-id.
 * @param {object[]} pagamentos
 */
function renderizarTabela(pagamentos) {
  corpoTabela.replaceChildren();
  semPagamentos.hidden = pagamentos.length > 0;

  for (const pagamento of pagamentos) {
    const tr = document.createElement("tr");
    tr.dataset.test = "linha-pagamento";
    tr.dataset.id = String(pagamento.id);

    const status = document.createElement("span");
    status.className = `status ${pagamento.status.toLowerCase()}`;
    status.dataset.test = "status-pagamento";
    status.textContent = pagamento.status;

    const acoes = document.createElement("div");
    acoes.className = "acoes-tabela";
    if (pagamento.status === "Cancelado") {
      tr.classList.add("linha-cancelada");
    } else {
      acoes.append(
        criarBotao("Editar", "btn-secundario", "btn-editar-pagamento", () => abrirModal(pagamento)),
        criarBotao("Cancelar", "btn-contorno-perigo", "btn-cancelar-pagamento", () => cancelarPagamento(pagamento))
      );
    }

    tr.append(
      criarCelula("Jogador", pagamento.jogador),
      criarCelula("Data", formatarData(pagamento.data_pagamento)),
      criarCelula("Valor", moeda.format(pagamento.valor)),
      criarCelula("Status", status),
      criarCelula("Ações", acoes)
    );
    corpoTabela.appendChild(tr);
  }
}

// ---------- Modal ----------

/** Remove a opção temporária de jogador inativo criada em uma edição anterior. */
function removerOpcaoTemporaria() {
  campos.jogador_id.querySelectorAll('option[data-temporaria="true"]').forEach((opcao) => opcao.remove());
}

/**
 * Abre o modal para lançar (sem pagamento) ou editar (com pagamento).
 * @param {object|null} [pagamento=null]
 * @param {string} [jogadorIdInicial] - Pré-seleção (atalho vindo do painel).
 */
function abrirModal(pagamento = null, jogadorIdInicial = "") {
  estado.pagamentoEmEdicao = pagamento;
  form.reset();
  removerOpcaoTemporaria();
  Object.values(campos).forEach((campo) => definirErroCampo(campo));
  erroFormulario.hidden = true;
  tituloModal.textContent = pagamento ? "Editar pagamento" : "Novo pagamento";

  if (pagamento) {
    const id = String(pagamento.jogador_id || "");
    // Jogador inativado depois do lançamento não está na lista de ativos:
    // criamos uma opção temporária só para esta edição.
    if (id && !campos.jogador_id.querySelector(`option[value="${id}"]`)) {
      const opcao = document.createElement("option");
      opcao.value = id;
      opcao.textContent = `${pagamento.jogador} (inativo)`;
      opcao.dataset.temporaria = "true";
      campos.jogador_id.appendChild(opcao);
    }
    campos.jogador_id.value = id;
    campos.data_pagamento.value = pagamento.data_pagamento;
    campos.valor.value = valorParaCampo(pagamento.valor);
    campos.status.value = pagamento.status;
  } else {
    campos.data_pagamento.value = hojeIso();
    if (jogadorIdInicial) {
      campos.jogador_id.value = jogadorIdInicial;
      sugerirValor();
    }
  }

  modal.showModal();
  campos.jogador_id.focus();
}

/** Em um NOVO lançamento, sugere o valor da mensalidade do jogador escolhido. */
function sugerirValor() {
  if (estado.pagamentoEmEdicao) return; // na edição, não sobrescreve o valor lançado
  const jogador = estado.jogadores.find((item) => String(item.id) === campos.jogador_id.value);
  if (jogador) campos.valor.value = valorParaCampo(jogador.valorMensalidade);
}

/**
 * Validação no navegador (o backend valida de novo).
 * @returns {boolean}
 */
function validarFormulario() {
  const erros = {};
  if (!campos.jogador_id.value) erros.jogador_id = "Selecione o jogador.";
  if (!campos.data_pagamento.value) erros.data_pagamento = "Informe a data.";
  const valor = converterValor(campos.valor.value);
  if (!Number.isFinite(valor) || valor <= 0) erros.valor = "Informe um valor maior que zero.";

  Object.entries(campos).forEach(([nome, campo]) => definirErroCampo(campo, erros[nome]));
  const primeiro = Object.keys(erros)[0];
  if (primeiro) campos[primeiro].focus();
  return !primeiro;
}

/**
 * Envia o formulário: POST (novo) ou PUT (edição).
 * @param {SubmitEvent} evento
 */
async function salvarPagamento(evento) {
  evento.preventDefault();
  erroFormulario.hidden = true;
  if (!validarFormulario()) return;

  const edicao = Boolean(estado.pagamentoEmEdicao);
  const corpo = {
    jogador_id: campos.jogador_id.value,
    data_pagamento: campos.data_pagamento.value,
    valor: campos.valor.value, // o backend aceita "80,50"
    status: campos.status.value
  };

  definirCarregando(btnSalvar, true);
  try {
    await api(edicao ? `/api/pagamentos/${estado.pagamentoEmEdicao.id}` : "/api/pagamentos", {
      metodo: edicao ? "PUT" : "POST",
      corpo
    });
    modal.close();
    mostrarToast(edicao ? "Pagamento atualizado com sucesso." : "Pagamento lançado com sucesso.");
    await carregarPagamentos();
  } catch (erro) {
    erroFormulario.textContent = erro instanceof ErroApi ? erro.erros.join(" ") : "Erro ao salvar pagamento.";
    erroFormulario.hidden = false;
  } finally {
    definirCarregando(btnSalvar, false);
  }
}

/**
 * Cancela um pagamento (exclusão lógica) após confirmação.
 * @param {object} pagamento
 */
async function cancelarPagamento(pagamento) {
  const confirmou = await confirmar({
    titulo: "Cancelar pagamento",
    mensagem: `Cancelar o lançamento de ${moeda.format(pagamento.valor)} de "${pagamento.jogador}" em ${formatarData(pagamento.data_pagamento)}? Ele continuará no histórico, mas não entrará nos totais.`,
    textoConfirmar: "Cancelar pagamento"
  });
  if (!confirmou) return;

  try {
    await api(`/api/pagamentos/${pagamento.id}/cancelar`, { metodo: "PATCH" });
    mostrarToast("Pagamento cancelado.");
    await carregarPagamentos();
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao cancelar pagamento.", "erro");
  }
}

// ---------- Eventos ----------
aplicarMascara(campos.valor, formatarValorDigitado);
campos.jogador_id.addEventListener("change", sugerirValor);
Object.values(campos).forEach((campo) => campo.addEventListener("input", () => definirErroCampo(campo)));

document.getElementById("btnNovoPagamento").addEventListener("click", () => abrirModal());
document.getElementById("btnFecharModalPagamento").addEventListener("click", () => modal.close());
form.addEventListener("submit", salvarPagamento);

// Qualquer filtro alterado volta para a página 1.
[filtroMes, filtroJogador, filtroStatus].forEach((filtro) => {
  filtro.addEventListener("change", () => {
    estado.pagina = 1;
    carregarPagamentos();
  });
});

document.getElementById("btnLimparFiltros").addEventListener("click", () => {
  filtroMes.value = "";
  filtroJogador.value = "";
  filtroStatus.value = "";
  estado.pagina = 1;
  carregarPagamentos();
});

btnAnterior.addEventListener("click", () => {
  estado.pagina = Math.max(1, estado.pagina - 1);
  carregarPagamentos();
});

btnProxima.addEventListener("click", () => {
  estado.pagina = Math.min(estado.totalPaginas, estado.pagina + 1);
  carregarPagamentos();
});

// ---------- Inicialização ----------
/**
 * Carrega os jogadores (necessários para os selects) e os pagamentos em paralelo.
 * Promise.all espera as duas requisições terminarem.
 */
async function iniciar() {
  try {
    await Promise.all([carregarJogadores(), carregarPagamentos()]);
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao carregar a tela.", "erro");
    return;
  }

  // Atalho do painel: ?novo=1&jogador=ID abre o modal já preenchido.
  const parametros = new URLSearchParams(window.location.search);
  if (parametros.get("novo") === "1") {
    abrirModal(null, parametros.get("jogador") || "");
    // Limpa a URL para que recarregar a página não reabra o modal.
    history.replaceState(null, "", window.location.pathname);
  }
}

iniciar();
