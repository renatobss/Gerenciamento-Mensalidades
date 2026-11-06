/**
 * FUNÇÕES DE VALIDAÇÃO REUTILIZÁVEIS
 * ----------------------------------
 * Pequenas funções "puras" (mesma entrada → mesma saída, sem efeitos colaterais).
 * Funções puras são fáceis de entender e de testar isoladamente.
 */

/**
 * Remove tudo que não for dígito. "123.456.789-09" → "12345678909".
 * @param {unknown} valor
 * @returns {string}
 */
function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, ""); // \D = qualquer caractere que NÃO é dígito
}

/**
 * Valida um CPF pelos DÍGITOS VERIFICADORES.
 *
 * Como funciona: os dois últimos dígitos do CPF são calculados a partir dos 9
 * primeiros. Multiplicamos cada dígito por um peso decrescente, somamos, e o
 * resto da divisão por 11 define o dígito esperado. Se o informado for
 * diferente do calculado, o CPF é inválido (digitação errada ou inventado).
 *
 * @param {string} cpf - Somente dígitos.
 * @returns {boolean}
 */
function validarCpf(cpf) {
  // 11 dígitos e não pode ser tudo igual (111.111.111-11 passa no cálculo, mas é inválido).
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  /**
   * Calcula um dígito verificador.
   * @param {number} quantidade - Quantos dígitos iniciais entram no cálculo (9 ou 10).
   * @returns {number}
   */
  const calcularDigito = (quantidade) => {
    let soma = 0;
    for (let i = 0; i < quantidade; i++) {
      soma += Number(cpf[i]) * (quantidade + 1 - i); // pesos 10..2 ou 11..2
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return calcularDigito(9) === Number(cpf[9]) && calcularDigito(10) === Number(cpf[10]);
}

/**
 * Verifica se um texto é uma data real no formato AAAA-MM-DD.
 * Só o formato não basta: "2026-02-31" tem o formato certo, mas não existe.
 * Por isso criamos a data e conferimos se dia/mês/ano "voltaram" iguais.
 *
 * @param {string} texto
 * @returns {boolean}
 */
function ehDataValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    return false;
  }
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/**
 * Data de hoje no formato AAAA-MM-DD, no fuso horário do servidor.
 * (toISOString() usaria UTC e, à noite no Brasil, já seria "amanhã".)
 * @returns {string}
 */
function hojeIso() {
  const agora = new Date();
  const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/**
 * Converte um valor monetário digitado em número.
 * Aceita "80", "80,50", "80.50" e "1.234,56" (formato brasileiro com milhar).
 * @param {unknown} valor
 * @returns {number} NaN se não for um número válido.
 */
function converterValorMonetario(valor) {
  if (typeof valor === "number") {
    return valor;
  }
  let texto = String(valor || "").trim().replace(/\s|R\$/g, "");
  // Se tem vírgula, ela é o separador decimal e os pontos são de milhar.
  if (texto.includes(",")) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  }
  return texto === "" ? NaN : Number(texto);
}

module.exports = { apenasDigitos, validarCpf, ehDataValida, hojeIso, converterValorMonetario };
