const form = document.querySelector("#pagamentoForm");
const pagamentoIdInput = document.querySelector("#pagamentoId");
const jogadorInput = document.querySelector("#jogador");
const dataPagamentoInput = document.querySelector("#dataPagamento");
const valorInput = document.querySelector("#valor");
const statusInput = document.querySelector("#status");
const mensagemErro = document.querySelector("#mensagemErro");
const salvarButton = document.querySelector("#salvarButton");
const cancelarButton = document.querySelector("#cancelarButton");
const filtroMesInput = document.querySelector("#filtroMes");
const tabela = document.querySelector("#pagamentosTabela");
const totalPago = document.querySelector("#totalPago");
const totalPendente = document.querySelector("#totalPendente");
const contadorPagamentos = document.querySelector("#contadorPagamentos");

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function formatarData(dataIso) {
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterDataHojeLocal() {
  const hoje = new Date();
  const diferencaDoUtcEmMinutos = hoje.getTimezoneOffset();
  const hojeNoFusoLocal = new Date(hoje.getTime() - diferencaDoUtcEmMinutos * 60000);

  return hojeNoFusoLocal.toISOString().slice(0, 10);
}

/**
 * Jogadores ativos carregados da API (para o select e para sugerir o valor).
 * @type {{ id: number, nomeCompleto: string, valorMensalidade: number }[]}
 */
let opcoesJogadores = [];

/**
 * Preenche o select de jogadores com os jogadores ATIVOS.
 * Cada <option> é criada com textContent (seguro contra XSS).
 */
async function carregarOpcoesJogadores() {
  let resposta;
  try {
    resposta = await fetch("/api/jogadores/opcoes");
  } catch (erro) {
    mostrarErros(["Nao foi possivel carregar os jogadores."]);
    return;
  }

  if (redirecionarSeNaoAutenticado(resposta)) {
    return;
  }

  opcoesJogadores = await resposta.json();

  // Mantém só a primeira opção ("Selecione...") e recria as demais.
  jogadorInput.length = 1;
  opcoesJogadores.forEach((jogador) => {
    const opcao = document.createElement("option");
    opcao.value = String(jogador.id);
    opcao.textContent = jogador.nomeCompleto;
    jogadorInput.appendChild(opcao);
  });
}

/**
 * Seleciona o jogador de um pagamento em edição. Se o jogador foi inativado
 * depois, ele não está na lista; então criamos uma opção temporária para ele.
 * @param {object} pagamento
 */
function selecionarJogadorDoPagamento(pagamento) {
  const id = String(pagamento.jogador_id || "");
  if (id && !jogadorInput.querySelector(`option[value="${id}"]`)) {
    const opcao = document.createElement("option");
    opcao.value = id;
    opcao.textContent = `${pagamento.jogador} (inativo)`;
    opcao.dataset.temporaria = "true";
    jogadorInput.appendChild(opcao);
  }
  jogadorInput.value = id;
}

/**
 * Ao escolher um jogador em um NOVO pagamento, sugere o valor da mensalidade dele.
 */
function sugerirValorDaMensalidade() {
  if (pagamentoIdInput.value) {
    return; // na edição, não sobrescreve o valor já lançado
  }
  const jogador = opcoesJogadores.find((item) => String(item.id) === jogadorInput.value);
  if (jogador) {
    valorInput.value = jogador.valorMensalidade.toFixed(2).replace(".", ",");
  }
}

function limparFormulario() {
  form.reset();
  pagamentoIdInput.value = "";
  mensagemErro.textContent = "";
  salvarButton.textContent = "Salvar";
  cancelarButton.hidden = true;
  dataPagamentoInput.value = obterDataHojeLocal();
  // Remove opções temporárias de jogadores inativos criadas na edição.
  jogadorInput.querySelectorAll('option[data-temporaria="true"]').forEach((opcao) => opcao.remove());
}

function mostrarErros(erros) {
  mensagemErro.textContent = erros.join(" ");
}

function lerDadosDoFormulario() {
  return {
    jogador_id: jogadorInput.value, // desde a Etapa 4, o pagamento aponta para um jogador cadastrado
    data_pagamento: dataPagamentoInput.value,
    valor: valorInput.value,        // o backend aceita "80,50"
    status: statusInput.value
  };
}

function manterSomenteValorMonetario() {
  const textoDigitado = valorInput.value.replace(/[^0-9,.]/g, "");
  const partes = textoDigitado.split(/[,.]/);

  if (partes.length === 1) {
    valorInput.value = partes[0];
    return;
  }

  valorInput.value = `${partes[0]},${partes.slice(1).join("").slice(0, 2)}`;
}

/**
 * Verifica se a sessão expirou (status 401) e, nesse caso, manda o usuário
 * para a tela de login. Sem isso, o código tentaria ler dados que não vieram
 * e a tela quebraria em silêncio.
 *
 * @param {Response} resposta - Resposta de um fetch().
 * @returns {boolean} true se redirecionou (quem chamou deve parar).
 */
function redirecionarSeNaoAutenticado(resposta) {
  if (resposta.status === 401) {
    // O parâmetro faz a tela de login exibir o aviso "Sua sessão expirou".
    window.location.href = "/login.html?sessao=expirada";
    return true;
  }
  return false;
}

async function buscarPagamentos() {
  const mes = filtroMesInput.value;
  // encodeURIComponent protege a URL caso o valor tenha caracteres especiais.
  const url = mes ? `/api/pagamentos?mes=${encodeURIComponent(mes)}` : "/api/pagamentos";

  let resposta;
  try {
    resposta = await fetch(url);
  } catch (erro) {
    // fetch só lança exceção em falha de REDE (servidor fora do ar, sem internet).
    mostrarErros(["Nao foi possivel conectar ao servidor."]);
    return;
  }

  if (redirecionarSeNaoAutenticado(resposta)) {
    return;
  }

  const dados = await resposta.json();

  renderizarTabela(dados.pagamentos);
  totalPago.textContent = moeda.format(dados.totalPago);
  totalPendente.textContent = moeda.format(dados.totalPendente);
}

function renderizarTabela(pagamentos) {
  tabela.innerHTML = "";
  contadorPagamentos.textContent = `${pagamentos.length} pagamento(s) encontrado(s)`;

  if (pagamentos.length === 0) {
    tabela.innerHTML = `
      <tr>
        <td class="empty-state" colspan="5">Nenhum pagamento encontrado.</td>
      </tr>
    `;
    return;
  }

  pagamentos.forEach((pagamento) => {
    const tr = document.createElement("tr");

    /**
     * SEGURANÇA (XSS): o HTML abaixo é FIXO, e nenhum dado do banco entra nele.
     * Os dados são inseridos depois com textContent, que trata o conteúdo como
     * texto puro. Antes, o nome do jogador ia direto no innerHTML: um nome como
     * <img src=x onerror=alert(1)> executaria JavaScript na tela de quem abrisse.
     */
    tr.innerHTML = `
      <td data-campo="jogador"></td>
      <td data-campo="data"></td>
      <td data-campo="valor"></td>
      <td><span data-campo="status"></span></td>
      <td>
        <div class="row-actions">
          <button class="small" data-action="editar">Editar</button>
          <button class="small danger" data-action="cancelar">Cancelar</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-campo="jogador"]').textContent = pagamento.jogador;
    tr.querySelector('[data-campo="data"]').textContent = formatarData(pagamento.data_pagamento);
    tr.querySelector('[data-campo="valor"]').textContent = moeda.format(pagamento.valor);

    const statusSpan = tr.querySelector('[data-campo="status"]');
    statusSpan.className = `status ${pagamento.status.toLowerCase()}`;
    statusSpan.textContent = pagamento.status;

    // Pagamento cancelado fica só como histórico: sem botões de ação.
    if (pagamento.status === "Cancelado") {
      tr.classList.add("linha-cancelada");
      tr.querySelector(".row-actions").remove();
      tabela.appendChild(tr);
      return; // dentro do forEach, "return" pula para o próximo pagamento
    }

    tr.querySelector('[data-action="editar"]').addEventListener("click", () => {
      pagamentoIdInput.value = pagamento.id;
      selecionarJogadorDoPagamento(pagamento);
      dataPagamentoInput.value = pagamento.data_pagamento;
      valorInput.value = pagamento.valor.toFixed(2).replace(".", ",");
      statusInput.value = pagamento.status;
      salvarButton.textContent = "Atualizar";
      cancelarButton.hidden = false;
      jogadorInput.focus();
    });

    /**
     * CANCELAMENTO LÓGICO: o pagamento não é apagado. Ele recebe o status
     * "Cancelado", continua no histórico e deixa de entrar nos totais.
     */
    tr.querySelector('[data-action="cancelar"]').addEventListener("click", async () => {
      const confirmou = confirm(
        `Cancelar o pagamento de ${pagamento.jogador}? Ele continuará no histórico, mas não entrará nos totais.`
      );

      if (!confirmou) {
        return;
      }

      const resposta = await fetch(`/api/pagamentos/${pagamento.id}/cancelar`, {
        method: "PATCH"
      });

      if (redirecionarSeNaoAutenticado(resposta)) {
        return;
      }

      if (!resposta.ok) {
        const erro = await resposta.json();
        mostrarErros(erro.erros || ["Nao foi possivel cancelar o pagamento."]);
        return;
      }

      await buscarPagamentos();
      limparFormulario();
    });

    tabela.appendChild(tr);
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  mensagemErro.textContent = "";

  const id = pagamentoIdInput.value;
  const dados = lerDadosDoFormulario();
  const url = id ? `/api/pagamentos/${id}` : "/api/pagamentos";
  const metodo = id ? "PUT" : "POST";

  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dados)
    });
  } catch (erro) {
    mostrarErros(["Nao foi possivel conectar ao servidor."]);
    return;
  }

  if (redirecionarSeNaoAutenticado(resposta)) {
    return;
  }

  if (!resposta.ok) {
    const erro = await resposta.json();
    mostrarErros(erro.erros || ["Nao foi possivel salvar o pagamento."]);
    return;
  }

  await buscarPagamentos();
  limparFormulario();
});

cancelarButton.addEventListener("click", limparFormulario);
filtroMesInput.addEventListener("change", buscarPagamentos);
valorInput.addEventListener("input", manterSomenteValorMonetario);
jogadorInput.addEventListener("change", sugerirValorDaMensalidade);

limparFormulario();
carregarOpcoesJogadores();
buscarPagamentos();
