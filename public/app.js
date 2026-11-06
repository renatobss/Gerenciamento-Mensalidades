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

async function buscarPagamentos() {
  const mes = filtroMesInput.value;
  const url = mes ? `/api/pagamentos?mes=${mes}` : "/api/pagamentos";
  const resposta = await fetch(url);
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

    tr.innerHTML = `
      <td>${pagamento.jogador}</td>
      <td>${formatarData(pagamento.data_pagamento)}</td>
      <td>${moeda.format(pagamento.valor)}</td>
      <td><span class="status ${pagamento.status.toLowerCase()}">${pagamento.status}</span></td>
      <td>
        <div class="row-actions">
          <button class="small" data-action="editar">Editar</button>
          <button class="small danger" data-action="excluir">Excluir</button>
        </div>
      </td>
    `;

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

      await fetch(`/api/pagamentos/${pagamento.id}`, {
        method: "DELETE"
      });

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

  const resposta = await fetch(url, {
    method: metodo,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(dados)
  });

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
