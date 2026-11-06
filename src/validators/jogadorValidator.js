/**
 * VALIDAÇÕES DE JOGADOR
 * ---------------------
 * Campos obrigatórios: nome completo, data de entrada e valor da mensalidade.
 * Campos opcionais (validados SE preenchidos): CPF, telefone, data de nascimento
 * e observações.
 *
 * Normalização: CPF e telefone são guardados apenas com dígitos. A formatação
 * (pontos, traços, parênteses) é papel da TELA, não do banco. Assim a busca e
 * a verificação de duplicidade não dependem de como o usuário digitou.
 */
const {
  apenasDigitos,
  validarCpf,
  ehDataValida,
  hojeIso,
  converterValorMonetario
} = require("../utils/validacoes");

const VALOR_MAXIMO_MENSALIDADE = 100000;
const OBSERVACOES_MAXIMO = 500;

/**
 * Converte o campo "ativo" (true/false ou "ativo"/"inativo") em booleano.
 * @param {unknown} valor
 * @returns {boolean|null} null quando inválido.
 */
function converterAtivo(valor) {
  if (valor === undefined || valor === true || valor === "ativo") return true;
  if (valor === false || valor === "inativo") return false;
  return null;
}

/**
 * Valida e normaliza os dados de um jogador.
 *
 * @param {object} dados - Corpo da requisição.
 * @returns {{ erros: string[], jogador: object }}
 */
function validarJogador(dados = {}) {
  const erros = [];
  const hoje = hojeIso();

  const nomeCompleto = String(dados.nomeCompleto || "").trim().replace(/\s+/g, " ");
  const cpf = apenasDigitos(dados.cpf);
  const telefone = apenasDigitos(dados.telefone);
  const dataNascimento = String(dados.dataNascimento || "").trim();
  const dataEntrada = String(dados.dataEntrada || "").trim();
  const valorMensalidade = converterValorMonetario(dados.valorMensalidade);
  const ativo = converterAtivo(dados.ativo);
  const observacoes = String(dados.observacoes || "").trim();

  if (nomeCompleto.length < 3 || nomeCompleto.length > 100) {
    erros.push("Informe o nome completo do jogador (3 a 100 caracteres).");
  }

  if (cpf && !validarCpf(cpf)) {
    erros.push("CPF inválido.");
  }

  // Telefone brasileiro: DDD + 8 dígitos (fixo) ou DDD + 9 dígitos (celular).
  if (telefone && !/^\d{10,11}$/.test(telefone)) {
    erros.push("Telefone inválido. Informe DDD + número.");
  }

  if (dataNascimento) {
    if (!ehDataValida(dataNascimento)) {
      erros.push("Data de nascimento inválida.");
    } else if (dataNascimento > hoje) {
      // Datas AAAA-MM-DD podem ser comparadas como texto: a ordem alfabética = ordem cronológica.
      erros.push("A data de nascimento não pode ser no futuro.");
    }
  }

  if (!ehDataValida(dataEntrada)) {
    erros.push("Informe uma data de entrada no grupo válida.");
  } else if (dataNascimento && ehDataValida(dataNascimento) && dataEntrada < dataNascimento) {
    erros.push("A data de entrada não pode ser anterior à data de nascimento.");
  }

  if (!Number.isFinite(valorMensalidade) || valorMensalidade <= 0 || valorMensalidade > VALOR_MAXIMO_MENSALIDADE) {
    erros.push("Informe um valor de mensalidade maior que zero.");
  }

  if (ativo === null) {
    erros.push("Selecione uma situação válida.");
  }

  if (observacoes.length > OBSERVACOES_MAXIMO) {
    erros.push(`As observações devem ter no máximo ${OBSERVACOES_MAXIMO} caracteres.`);
  }

  return {
    erros,
    jogador: {
      nomeCompleto,
      cpf: cpf || null, // vazio vira null (o índice único ignora nulos)
      telefone: telefone || null,
      dataNascimento: dataNascimento || null,
      dataEntrada,
      // Arredonda para centavos (evita 70.0000001 por causa de ponto flutuante).
      valorMensalidade: Math.round(valorMensalidade * 100) / 100,
      ativo,
      observacoes: observacoes || null
    }
  };
}

module.exports = { validarJogador };
