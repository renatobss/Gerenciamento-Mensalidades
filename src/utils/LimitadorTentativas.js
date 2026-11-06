/**
 * LIMITADOR DE TENTATIVAS (proteção contra força bruta)
 * -----------------------------------------------------
 * Ataque de força bruta = tentar milhares de senhas até acertar.
 * Defesa: depois de N falhas seguidas, bloquear novas tentativas por um tempo.
 *
 * Os registros ficam na MEMÓRIA do servidor (um Map). É simples e suficiente
 * para um único servidor. Em sistemas maiores, com vários servidores, isso
 * ficaria em um armazenamento compartilhado (ex.: Redis).
 *
 * A "chave" identifica quem está tentando. Usamos IP + usuário:
 * - só o IP bloquearia todos que compartilham a mesma internet;
 * - só o usuário permitiria a qualquer pessoa bloquear o admin de propósito.
 *
 * Conceito: CLASSE. Ela agrupa dados (os registros) e comportamentos (os
 * métodos). "new LimitadorTentativas(...)" cria um objeto independente.
 */
class LimitadorTentativas {
  /**
   * @param {object} opcoes
   * @param {number} opcoes.maxTentativas - Falhas permitidas antes do bloqueio.
   * @param {number} opcoes.bloqueioMs - Duração do bloqueio e da janela de contagem (ms).
   */
  constructor({ maxTentativas, bloqueioMs }) {
    this.maxTentativas = maxTentativas;
    this.bloqueioMs = bloqueioMs;
    /** @type {Map<string, {falhas: number, inicio: number, bloqueadoAte: number}>} */
    this.registros = new Map();
  }

  /**
   * Informa quanto tempo falta para o bloqueio acabar.
   * @param {string} chave
   * @returns {number} Milissegundos restantes (0 = não está bloqueado).
   */
  tempoRestanteBloqueio(chave) {
    const registro = this.registros.get(chave);
    const agora = Date.now();

    if (!registro || !registro.bloqueadoAte) {
      return 0;
    }

    if (registro.bloqueadoAte <= agora) {
      this.registros.delete(chave); // bloqueio venceu: zera a contagem
      return 0;
    }

    return registro.bloqueadoAte - agora;
  }

  /**
   * Registra uma tentativa que falhou e bloqueia ao atingir o limite.
   * @param {string} chave
   */
  registrarFalha(chave) {
    const agora = Date.now();
    let registro = this.registros.get(chave);

    // Primeira falha, ou a última foi há muito tempo: começa nova contagem.
    if (!registro || agora - registro.inicio > this.bloqueioMs) {
      registro = { falhas: 0, inicio: agora, bloqueadoAte: 0 };
      this.registros.set(chave, registro);
    }

    registro.falhas++;

    if (registro.falhas >= this.maxTentativas) {
      registro.bloqueadoAte = agora + this.bloqueioMs;
    }

    this.removerExpirados(agora);
  }

  /**
   * Apaga o histórico da chave (chamado após um login bem-sucedido).
   * @param {string} chave
   */
  limpar(chave) {
    this.registros.delete(chave);
  }

  /**
   * Evita que o Map cresça para sempre: remove registros antigos.
   * Só roda quando há muitos registros, para não gastar CPU à toa.
   * @param {number} agora - Timestamp atual.
   */
  removerExpirados(agora) {
    if (this.registros.size < 1000) {
      return;
    }

    for (const [chave, registro] of this.registros) {
      const expirou = Math.max(registro.bloqueadoAte, registro.inicio + this.bloqueioMs) <= agora;
      if (expirou) {
        this.registros.delete(chave);
      }
    }
  }
}

module.exports = LimitadorTentativas;
