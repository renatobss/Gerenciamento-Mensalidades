/**
 * PAINEL (DASHBOARD) - frontend
 * -----------------------------
 * Busca GET /api/dashboard?mes=AAAA-MM e desenha:
 *   1. o destaque "Arrecadado no mês" + medidor contra o previsto;
 *   2. a linha de indicadores (cards);
 *   3. o gráfico de colunas dos últimos 6 meses (com tooltip e tabela de apoio);
 *   4. as listas de acompanhamento.
 *
 * Decisões de visualização (por quê):
 * - Um número isolado não precisa de gráfico: vira "valor em destaque" ou card.
 * - "Quanto já entrou do previsto" é uma razão contra um limite → MEDIDOR.
 * - Evolução de um único valor no tempo → COLUNAS de uma só cor.
 * - Todo valor do gráfico também está na tabela (acessível sem mouse).
 */
import { api, ErroApi } from "./api.js";
import { mostrarToast } from "./ui.js";
import { moeda, formatarData, hojeIso } from "./mascaras.js";

const filtroMes = document.getElementById("filtroMesDashboard");
const conteudo = document.getElementById("conteudoDashboard");
const grafico = document.getElementById("graficoEvolucao");
const dica = document.getElementById("dicaGrafico");

/**
 * "2026-05" → "mai/26" (rótulo curto para o eixo do gráfico).
 * @param {string} mes - AAAA-MM
 * @param {boolean} [longo=false] - true → "maio de 2026"
 * @returns {string}
 */
function formatarMes(mes, longo = false) {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero - 1, 1);
  if (longo) {
    return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  const nome = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${nome}/${String(ano).slice(2)}`;
}

/**
 * Atalho para preencher o texto de um elemento pelo data-test.
 * @param {string} dataTest
 * @param {string} texto
 * @param {string} [campo] - data-campo interno (para os cards).
 */
function preencher(dataTest, texto, campo) {
  const base = document.querySelector(`[data-test="${dataTest}"]`);
  const alvo = campo ? base.querySelector(`[data-campo="${campo}"]`) : base;
  alvo.textContent = texto;
}

/**
 * Desenha o destaque de arrecadação e o medidor.
 * @param {object} dados - Resposta da API.
 */
function renderizarDestaque(dados) {
  const previsto = dados.valorPrevistoMes;
  // Math.min(100, ...) evita barra "estourando" se arrecadar mais que o previsto.
  const percentual = previsto > 0 ? Math.round((dados.totalPagoMes / previsto) * 100) : 0;

  preencher("valor-arrecadado-mes", moeda.format(dados.totalPagoMes));
  preencher("texto-previsto-mes", `de ${moeda.format(previsto)} previstos em ${formatarMes(dados.mes, true)}`);
  preencher("percentual-arrecadado", `${percentual}%`);

  document.getElementById("medidorPreenchimento").style.width = `${Math.min(100, percentual)}%`;
  document.querySelector('[data-test="medidor-arrecadacao"]').setAttribute("aria-valuenow", String(Math.min(100, percentual)));
}

/**
 * Preenche os cards da linha de indicadores.
 * @param {object} dados
 */
function renderizarIndicadores(dados) {
  preencher("card-jogadores-ativos", String(dados.jogadoresAtivos), "valor");
  preencher("card-pendente-mes", moeda.format(dados.totalPendenteMes), "valor");
  preencher("card-pendente-mes", `${dados.quantidadePendentesMes} lançamento(s) pendente(s)`, "detalhe");
  preencher("card-sem-lancamento", String(dados.semLancamentoNoMes.length), "valor");
  preencher("card-pendente-geral", moeda.format(dados.pendenteGeral), "valor");
}

/**
 * Mostra o tooltip do gráfico junto à coluna.
 * @param {HTMLElement} item - Área clicável da coluna.
 * @param {{ mes: string, totalPago: number }} ponto
 */
function mostrarDica(item, ponto) {
  dica.replaceChildren();
  // Valor em destaque, rótulo depois (quem passa o mouse quer o número).
  const valor = document.createElement("strong");
  valor.textContent = moeda.format(ponto.totalPago);
  const rotulo = document.createElement("span");
  rotulo.textContent = `Pago em ${formatarMes(ponto.mes, true)}`;
  dica.append(valor, rotulo);
  dica.hidden = false;

  // Posiciona centralizado acima da coluna, relativo ao cartão do gráfico.
  const caixaItem = item.getBoundingClientRect();
  const caixaCartao = grafico.parentElement.getBoundingClientRect();
  dica.style.left = `${caixaItem.left - caixaCartao.left + caixaItem.width / 2}px`;
  dica.style.top = `${caixaItem.top - caixaCartao.top}px`;
}

/**
 * Desenha o gráfico de colunas e a tabela de apoio.
 * Cada coluna é um elemento focável (tabindex=0): quem usa teclado também vê
 * o tooltip, e o aria-label descreve o valor para leitores de tela.
 *
 * @param {{ mes: string, totalPago: number }[]} evolucao
 * @param {string} mesSelecionado
 */
function renderizarGrafico(evolucao, mesSelecionado) {
  const maximo = Math.max(...evolucao.map((ponto) => ponto.totalPago), 0);
  grafico.replaceChildren();

  for (const ponto of evolucao) {
    const item = document.createElement("div");
    item.className = "grafico-item";
    item.tabIndex = 0;
    item.dataset.test = "coluna-grafico";
    item.dataset.mes = ponto.mes;
    item.setAttribute("aria-label", `${formatarMes(ponto.mes, true)}: ${moeda.format(ponto.totalPago)} pagos`);

    const area = document.createElement("div");
    area.className = "grafico-area";

    // Rótulo direto SÓ no mês selecionado (rotular todas as colunas vira poluição).
    if (ponto.mes === mesSelecionado && ponto.totalPago > 0) {
      const valor = document.createElement("span");
      valor.className = "grafico-valor";
      valor.textContent = moeda.format(ponto.totalPago);
      area.appendChild(valor);
    }

    const coluna = document.createElement("div");
    coluna.className = "grafico-coluna";
    if (ponto.mes === mesSelecionado) coluna.classList.add("selecionada");
    // Altura proporcional ao maior valor. Mês com zero não desenha coluna.
    coluna.style.height = maximo > 0 ? `${(ponto.totalPago / maximo) * 100}%` : "0";
    area.appendChild(coluna);

    const rotulo = document.createElement("span");
    rotulo.className = "grafico-rotulo";
    rotulo.textContent = formatarMes(ponto.mes);

    item.append(area, rotulo);

    // A área de hover é o item inteiro (maior que a coluna), não só a barra pintada.
    item.addEventListener("pointerenter", () => mostrarDica(item, ponto));
    item.addEventListener("focus", () => mostrarDica(item, ponto));
    item.addEventListener("pointerleave", () => { dica.hidden = true; });
    item.addEventListener("blur", () => { dica.hidden = true; });

    grafico.appendChild(item);
  }

  // Tabela de apoio com os mesmos números.
  const corpo = document.getElementById("corpoTabelaEvolucao");
  corpo.replaceChildren();
  for (const ponto of evolucao) {
    const tr = document.createElement("tr");
    const tdMes = document.createElement("td");
    tdMes.textContent = formatarMes(ponto.mes, true);
    const tdValor = document.createElement("td");
    tdValor.textContent = moeda.format(ponto.totalPago);
    tr.append(tdMes, tdValor);
    corpo.appendChild(tr);
  }
}

/**
 * Desenha uma lista genérica (itens com texto principal, detalhe e valor/ação).
 * @param {string} idLista
 * @param {string} idVazio - Mensagem exibida quando não há itens.
 * @param {object[]} itens
 * @param {(item: object) => { titulo: string, detalhe?: string, lado?: Node|string, dataTest: string }} montar
 */
function renderizarLista(idLista, idVazio, itens, montar) {
  const lista = document.getElementById(idLista);
  lista.replaceChildren();
  document.getElementById(idVazio).hidden = itens.length > 0;

  for (const item of itens) {
    const { titulo, detalhe, lado, dataTest } = montar(item);
    const li = document.createElement("li");
    li.className = "lista-item";
    li.dataset.test = dataTest;

    const texto = document.createElement("div");
    const forte = document.createElement("strong");
    forte.textContent = titulo;
    texto.appendChild(forte);
    if (detalhe) {
      const span = document.createElement("span");
      span.className = "texto-secundario";
      span.textContent = detalhe;
      texto.appendChild(span);
    }

    li.appendChild(texto);
    if (lado instanceof Node) li.appendChild(lado);
    else if (lado) {
      const valor = document.createElement("span");
      valor.className = "lista-valor";
      valor.textContent = lado;
      li.appendChild(valor);
    }
    lista.appendChild(li);
  }
}

/**
 * Desenha as três listas do painel.
 * @param {object} dados
 */
function renderizarListas(dados) {
  renderizarLista("listaSemLancamento", "semLancamentoVazio", dados.semLancamentoNoMes, (jogador) => {
    // Atalho: abre a tela de mensalidades já com o formulário preenchido para este jogador.
    const link = document.createElement("a");
    link.className = "btn btn-secundario btn-pequeno";
    link.href = `/mensalidades.html?novo=1&jogador=${encodeURIComponent(jogador.id)}`;
    link.dataset.test = "btn-registrar-pagamento";
    link.textContent = "Registrar";
    return {
      titulo: jogador.nomeCompleto,
      detalhe: `Mensalidade ${moeda.format(jogador.valorMensalidade)}`,
      lado: link,
      dataTest: "item-sem-lancamento"
    };
  });

  renderizarLista("listaPendencias", "pendenciasVazio", dados.maioresPendencias, (item) => ({
    titulo: item.nomeCompleto,
    detalhe: `${item.quantidade} lançamento(s) pendente(s)`,
    lado: moeda.format(item.total),
    dataTest: "item-pendencia"
  }));

  renderizarLista("listaUltimos", "ultimosVazio", dados.ultimosPagamentos, (pagamento) => {
    const etiqueta = document.createElement("span");
    etiqueta.className = `status ${pagamento.status.toLowerCase()}`;
    etiqueta.textContent = `${moeda.format(pagamento.valor)} · ${pagamento.status}`;
    return {
      titulo: pagamento.jogador,
      detalhe: formatarData(pagamento.data_pagamento),
      lado: etiqueta,
      dataTest: "item-ultimo-pagamento"
    };
  });
}

/** Busca os dados do mês selecionado e redesenha o painel. */
async function carregarDashboard() {
  // Mantém o conteúdo anterior na tela, só mais apagado, enquanto recarrega.
  conteudo.classList.add("recarregando");
  try {
    const dados = await api(`/api/dashboard?mes=${encodeURIComponent(filtroMes.value)}`);
    renderizarDestaque(dados);
    renderizarIndicadores(dados);
    renderizarGrafico(dados.evolucao, dados.mes);
    renderizarListas(dados);
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao carregar o painel.", "erro");
  } finally {
    conteudo.classList.remove("recarregando");
  }
}

filtroMes.value = hojeIso().slice(0, 7); // começa no mês atual
filtroMes.addEventListener("change", carregarDashboard);
carregarDashboard();
