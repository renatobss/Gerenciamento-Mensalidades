/**
 * SERVICE DO DASHBOARD (painel de indicadores)
 * --------------------------------------------
 * Reúne, em uma única resposta, os números que a tela inicial mostra.
 * Uma só requisição evita que a tela faça 6 chamadas diferentes e garante que
 * todos os números se refiram ao MESMO mês.
 *
 * Conceitos de SQL usados aqui:
 * - Funções de agregação: COUNT (contar), SUM (somar), coalesce (trocar NULL por 0).
 * - GROUP BY: agrupa linhas (ex.: por status ou por jogador) antes de somar.
 * - NOT EXISTS: "jogadores para os quais NÃO existe pagamento no mês".
 * - JOIN: junta pagamentos e jogadores para mostrar o nome.
 *
 * Observação de regra de negócio: o mês de um pagamento é o mês da sua
 * data_pagamento (o sistema ainda não tem um campo "mês de referência").
 * Pagamentos cancelados nunca entram nos números.
 */
const db = require("../config/database");
const { hojeIso } = require("../utils/validacoes");

const MESES_NA_EVOLUCAO = 6;

/**
 * Gera a lista dos últimos N meses terminando no mês informado.
 * Ex.: ("2026-02", 3) → ["2025-12", "2026-01", "2026-02"]
 * @param {string} mesFinal - AAAA-MM
 * @param {number} quantidade
 * @returns {string[]}
 */
function listarMesesAte(mesFinal, quantidade) {
  const [ano, mes] = mesFinal.split("-").map(Number);
  const meses = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    // Date.UTC lida sozinho com a "virada" do ano (mês -1 vira dezembro do ano anterior).
    const data = new Date(Date.UTC(ano, mes - 1 - i, 1));
    meses.push(data.toISOString().slice(0, 7));
  }
  return meses;
}

/**
 * Monta todos os indicadores do painel.
 * @param {string} [mesInformado] - AAAA-MM; inválido ou vazio = mês atual.
 * @returns {object}
 */
function obterResumo(mesInformado) {
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(mesInformado || ""))
    ? mesInformado
    : hojeIso().slice(0, 7);

  // Jogadores ativos e quanto deveria entrar por mês (soma das mensalidades).
  const elenco = db.prepare(`
    SELECT COUNT(*) AS jogadoresAtivos, coalesce(SUM(valor_mensalidade), 0) AS valorPrevisto
    FROM jogadores
    WHERE ativo = 1
  `).get();

  // Totais do mês por status (GROUP BY devolve uma linha para cada status).
  const porStatus = db.prepare(`
    SELECT status, COUNT(*) AS quantidade, coalesce(SUM(valor), 0) AS total
    FROM pagamentos
    WHERE substr(data_pagamento, 1, 7) = ? AND status <> 'Cancelado'
    GROUP BY status
  `).all(mes);

  const totalDoStatus = (status) => porStatus.find((linha) => linha.status === status)?.total || 0;
  const quantidadeDoStatus = (status) => porStatus.find((linha) => linha.status === status)?.quantidade || 0;

  const { pendenteGeral } = db.prepare(`
    SELECT coalesce(SUM(valor), 0) AS pendenteGeral FROM pagamentos WHERE status = 'Pendente'
  `).get();

  // Jogadores ativos SEM nenhum lançamento (pago ou pendente) no mês.
  const semLancamentoNoMes = db.prepare(`
    SELECT j.id, j.nome_completo AS nomeCompleto, j.valor_mensalidade AS valorMensalidade
    FROM jogadores j
    WHERE j.ativo = 1
      AND NOT EXISTS (
        SELECT 1 FROM pagamentos p
        WHERE p.jogador_id = j.id
          AND substr(p.data_pagamento, 1, 7) = ?
          AND p.status <> 'Cancelado'
      )
    ORDER BY lower(j.nome_completo)
  `).all(mes);

  // Os 5 jogadores que mais devem (todas as datas).
  const maioresPendencias = db.prepare(`
    SELECT j.id, j.nome_completo AS nomeCompleto, SUM(p.valor) AS total, COUNT(*) AS quantidade
    FROM pagamentos p
    JOIN jogadores j ON j.id = p.jogador_id
    WHERE p.status = 'Pendente'
    GROUP BY j.id
    ORDER BY total DESC, lower(j.nome_completo)
    LIMIT 5
  `).all();

  // Valor PAGO em cada um dos últimos 6 meses (meses sem pagamento aparecem com 0).
  const meses = listarMesesAte(mes, MESES_NA_EVOLUCAO);
  const pagosPorMes = db.prepare(`
    SELECT substr(data_pagamento, 1, 7) AS mes, SUM(valor) AS total
    FROM pagamentos
    WHERE status = 'Pago' AND substr(data_pagamento, 1, 7) BETWEEN ? AND ?
    GROUP BY substr(data_pagamento, 1, 7)
  `).all(meses[0], meses[meses.length - 1]);

  const evolucao = meses.map((item) => ({
    mes: item,
    totalPago: pagosPorMes.find((linha) => linha.mes === item)?.total || 0
  }));

  const ultimosPagamentos = db.prepare(`
    SELECT p.id, coalesce(j.nome_completo, p.jogador) AS jogador, p.data_pagamento, p.valor, p.status
    FROM pagamentos p
    LEFT JOIN jogadores j ON j.id = p.jogador_id
    WHERE p.status <> 'Cancelado'
    ORDER BY p.data_pagamento DESC, p.id DESC
    LIMIT 5
  `).all();

  return {
    mes,
    jogadoresAtivos: elenco.jogadoresAtivos,
    valorPrevistoMes: elenco.valorPrevisto,
    totalPagoMes: totalDoStatus("Pago"),
    totalPendenteMes: totalDoStatus("Pendente"),
    quantidadePagosMes: quantidadeDoStatus("Pago"),
    quantidadePendentesMes: quantidadeDoStatus("Pendente"),
    pendenteGeral,
    semLancamentoNoMes,
    maioresPendencias,
    evolucao,
    ultimosPagamentos
  };
}

module.exports = { obterResumo, listarMesesAte };
