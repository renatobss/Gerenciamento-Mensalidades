/**
 * MÁSCARAS E FORMATAÇÃO DE CAMPOS
 * -------------------------------
 * Máscara = formatar o texto ENQUANTO o usuário digita (ex.: 12345678909 →
 * 123.456.789-09). Ajuda a digitar certo, mas é só visual: antes de enviar,
 * o backend remove a formatação e valida de novo.
 *
 * A validação do CPF aqui é a mesma do backend (src/utils/validacoes.js).
 * Ela fica duplicada de propósito: no frontend dá retorno imediato; no backend
 * garante a integridade.
 */

/**
 * Remove tudo que não for dígito.
 * @param {string} valor
 * @returns {string}
 */
export function apenasDigitos(valor) {
  return String(valor || "").replace(/\D/g, "");
}

/**
 * Formata um CPF: "12345678909" → "123.456.789-09" (aceita digitação parcial).
 * Cada replace com regex insere um separador quando já há dígitos suficientes.
 * @param {string} valor
 * @returns {string}
 */
export function formatarCpf(valor) {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/**
 * Formata um telefone: "11987654321" → "(11) 98765-4321";
 * "1133334444" → "(11) 3333-4444".
 * @param {string} valor
 * @returns {string}
 */
export function formatarTelefone(valor) {
  const digitos = apenasDigitos(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos ? `(${digitos}` : "";
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  // Celular (11 dígitos) tem 5 dígitos antes do traço; fixo (10) tem 4.
  const meio = digitos.length === 11 ? 7 : 6;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, meio)}-${digitos.slice(meio)}`;
}

/**
 * Mantém só números e uma vírgula decimal com no máximo 2 casas: "80,5" / "120,00".
 * @param {string} valor
 * @returns {string}
 */
export function formatarValorDigitado(valor) {
  const texto = String(valor || "").replace(/[^0-9,.]/g, "").replace(".", ",");
  const [inteiro, ...resto] = texto.split(",");
  return resto.length ? `${inteiro},${resto.join("").slice(0, 2)}` : inteiro;
}

/**
 * Converte "1234,5" em número 1234.5.
 * @param {string} valor
 * @returns {number}
 */
export function converterValor(valor) {
  const texto = String(valor || "").replace(/\./g, "").replace(",", ".");
  return texto === "" ? NaN : Number(texto);
}

/**
 * Número → texto para o campo de valor: 70 → "70,00".
 * @param {number} numero
 * @returns {string}
 */
export function valorParaCampo(numero) {
  return Number(numero).toFixed(2).replace(".", ",");
}

/** Formatador de moeda brasileira reutilizável: 70 → "R$ 70,00". */
export const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "2026-05-09" → "09/05/2026". Vazio → "—".
 * @param {string|null} dataIso
 * @returns {string}
 */
export function formatarData(dataIso) {
  if (!dataIso) return "—";
  const [ano, mes, dia] = dataIso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Data de hoje no formato AAAA-MM-DD, no fuso horário local.
 * @returns {string}
 */
export function hojeIso() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Valida um CPF pelos dígitos verificadores (mesma regra do backend).
 * @param {string} cpf - Com ou sem formatação.
 * @returns {boolean}
 */
export function validarCpf(cpf) {
  const d = apenasDigitos(cpf);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/**
 * Liga uma máscara a um campo: a cada digitação o valor é reformatado.
 * @param {HTMLInputElement} campo
 * @param {(valor: string) => string} formatador
 */
export function aplicarMascara(campo, formatador) {
  campo.addEventListener("input", () => {
    campo.value = formatador(campo.value);
  });
}
