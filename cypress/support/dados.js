/**
 * GERADORES DE MASSA DE DADOS
 * ---------------------------
 * Cada teste cria seus próprios dados com valores ÚNICOS. Assim os testes não
 * dependem uns dos outros nem da ordem em que rodam (testes independentes).
 */

/**
 * Sufixo único para nomes, e-mails e usuários: ex. "lx3k9a".
 * @returns {string}
 */
export function sufixoUnico() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

/**
 * Gera um CPF VÁLIDO (com dígitos verificadores corretos), apenas com dígitos.
 * Mesmo algoritmo usado pela aplicação para validar.
 * @returns {string} 11 dígitos
 */
export function gerarCpf() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  // Evita a sequência de dígitos iguais, que é inválida.
  if (base.every((digito) => digito === base[0])) base[0] = (base[0] + 1) % 10;

  const calcular = (digitos) => {
    const soma = digitos.reduce((total, digito, i) => total + digito * (digitos.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcular(base);
  const d2 = calcular([...base, d1]);
  return [...base, d1, d2].join("");
}

/**
 * "12345678909" → "123.456.789-09"
 * @param {string} cpf
 * @returns {string}
 */
export function formatarCpf(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/**
 * Formata um valor como a aplicação formata: 90 → "R$ 90,00".
 *
 * ATENÇÃO: o Intl usa um ESPAÇO NÃO SEPARÁVEL ( ) entre "R$" e o número.
 * Comparar com "R$ 90,00" digitado no teste (espaço comum) FALHA. Por isso
 * geramos o texto esperado com a mesma função usada pela aplicação.
 *
 * @param {number} valor
 * @returns {string}
 */
export function formatarMoeda(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/**
 * Data de hoje em AAAA-MM-DD (fuso local).
 * @returns {string}
 */
export function hojeIso() {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Monta um jogador válido; "sobrescrever" permite mudar campos específicos.
 * @param {object} [sobrescrever]
 * @returns {object}
 */
export function novoJogador(sobrescrever = {}) {
  return {
    nomeCompleto: `Jogador Teste ${sufixoUnico()}`,
    cpf: gerarCpf(),
    telefone: "11987654321",
    dataNascimento: "1995-04-10",
    dataEntrada: "2026-01-15",
    valorMensalidade: "80,00",
    ativo: "ativo",
    observacoes: "Criado pelo Cypress",
    ...sobrescrever // "spread": os campos informados substituem os padrões
  };
}

/**
 * Monta um usuário válido.
 * @param {object} [sobrescrever]
 * @returns {object}
 */
export function novoUsuario(sobrescrever = {}) {
  const sufixo = sufixoUnico();
  return {
    nomeCompleto: `Usuario Teste ${sufixo}`,
    email: `teste.${sufixo}@exemplo.com`,
    usuario: `teste.${sufixo}`,
    senha: "senha123",
    confirmarSenha: "senha123",
    perfil: "comum",
    ativo: "ativo",
    ...sobrescrever
  };
}
