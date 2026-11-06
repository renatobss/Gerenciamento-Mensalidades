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

function limparFormulario() {
  form.reset();
  pagamentoIdInput.value = "";
  mensagemErro.textContent = "";
  salvarButton.textContent = "Salvar";
  cancelarButton.hidden = true;
  dataPagamentoInput.value = obterDataHojeLocal();
}

function mostrarErros(erros) {
  mensagemErro.textContent = erros.join(" ");
}

function lerDadosDoFormulario() {
  return {
    jogador: jogadorInput.value,
    data_pagamento: dataPagamentoInput.value,
    valor: valorInput.value.replace(",", "."),
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
    window.location.href = "/login.html";
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
          <button class="small danger" data-action="excluir">Excluir</button>
        </div>
      </td>
    `;

    tr.querySelector('[data-campo="jogador"]').textContent = pagamento.jogador;
    tr.querySelector('[data-campo="data"]').textContent = formatarData(pagamento.data_pagamento);
    tr.querySelector('[data-campo="valor"]').textContent = moeda.format(pagamento.valor);

    const statusSpan = tr.querySelector('[data-campo="status"]');
    statusSpan.className = `status ${pagamento.status.toLowerCase()}`;
    statusSpan.textContent = pagamento.status;

    tr.querySelector('[data-action="editar"]').addEventListener("click", () => {
      pagamentoIdInput.value = pagamento.id;
      jogadorInput.value = pagamento.jogador;
      dataPagamentoInput.value = pagamento.data_pagamento;
      valorInput.value = pagamento.valor;
      statusInput.value = pagamento.status;
      salvarButton.textContent = "Atualizar";
      cancelarButton.hidden = false;
      jogadorInput.focus();
    });

    tr.querySelector('[data-action="excluir"]').addEventListener("click", async () => {
      const confirmou = confirm(`Excluir o pagamento de ${pagamento.jogador}?`);

      if (!confirmou) {
        return;
      }

      const resposta = await fetch(`/api/pagamentos/${pagamento.id}`, {
        method: "DELETE"
      });

      if (redirecionarSeNaoAutenticado(resposta)) {
        return;
      }

      // 204 = excluído. Qualquer outro status de erro mostra a mensagem da API.
      if (!resposta.ok) {
        const erro = await resposta.json();
        mostrarErros(erro.erros || ["Nao foi possivel excluir o pagamento."]);
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

limparFormulario();
buscarPagamentos();
