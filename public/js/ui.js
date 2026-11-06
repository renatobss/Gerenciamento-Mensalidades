/**
 * COMPONENTES DE INTERFACE REUTILIZÁVEIS
 * --------------------------------------
 * Funções usadas por várias telas para manter o mesmo comportamento visual:
 *   - mostrarToast:     aviso temporário no canto da tela ("Usuário salvo!");
 *   - confirmar:        janela de confirmação (substitui o confirm() nativo);
 *   - definirErroCampo: mensagem de erro abaixo de um campo;
 *   - definirCarregando: estado "carregando" de um botão;
 *   - debounce:         adia a execução de uma função (pesquisa enquanto digita).
 */

/**
 * Obtém (ou cria na primeira vez) o contêiner onde os toasts aparecem.
 * aria-live="polite" faz leitores de tela anunciarem as mensagens novas.
 * @returns {HTMLElement}
 */
function obterContainerToasts() {
  let container = document.getElementById("toasts");
  if (!container) {
    container = document.createElement("div");
    container.id = "toasts";
    container.className = "toasts";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Exibe uma mensagem temporária (toast).
 *
 * data-test="toast" + data-tipo permitem ao Cypress verificar o resultado:
 *   cy.get('[data-test="toast"][data-tipo="sucesso"]').should('be.visible')
 *
 * @param {string} mensagem - Texto exibido.
 * @param {"sucesso"|"erro"|"info"} [tipo="sucesso"]
 * @param {number} [duracaoMs=4000] - Tempo até sumir.
 */
export function mostrarToast(mensagem, tipo = "sucesso", duracaoMs = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.setAttribute("role", tipo === "erro" ? "alert" : "status");
  toast.dataset.test = "toast"; // dataset.test vira o atributo data-test
  toast.dataset.tipo = tipo;
  toast.textContent = mensagem; // textContent: nunca interpreta HTML (seguro contra XSS)

  obterContainerToasts().appendChild(toast);

  setTimeout(() => {
    toast.classList.add("saindo");
    // Remove o elemento depois da animação de saída (definida no CSS).
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    // Segurança: se a animação não rodar (aba em segundo plano), remove assim mesmo.
    setTimeout(() => toast.remove(), 500);
  }, duracaoMs);
}

/**
 * Cria (uma única vez) o <dialog> de confirmação.
 * O elemento <dialog> é nativo do HTML: com showModal() ele abre por cima da
 * página, bloqueia o fundo e fecha com a tecla Esc.
 * @returns {HTMLDialogElement}
 */
function obterDialogoConfirmacao() {
  let dialogo = document.getElementById("modalConfirmacao");
  if (dialogo) {
    return dialogo;
  }

  dialogo = document.createElement("dialog");
  dialogo.id = "modalConfirmacao";
  dialogo.className = "modal modal-pequeno";
  dialogo.dataset.test = "modal-confirmacao";
  // HTML fixo, sem dados do usuário: os textos entram depois via textContent.
  dialogo.innerHTML = `
    <form method="dialog" class="modal-conteudo">
      <h2 class="modal-titulo" data-campo="titulo"></h2>
      <p class="modal-texto" data-campo="mensagem" data-test="mensagem-confirmacao"></p>
      <div class="modal-acoes">
        <button type="submit" value="cancelar" class="btn btn-secundario" data-test="btn-cancelar-confirmacao">Cancelar</button>
        <button type="submit" value="confirmar" class="btn btn-perigo" data-campo="confirmar" data-test="btn-confirmar">Confirmar</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialogo);
  return dialogo;
}

/**
 * Abre uma janela de confirmação e espera a resposta do usuário.
 *
 * Conceito: PROMISE criada "na mão". A função devolve uma Promise que só se
 * resolve quando o diálogo fecha. Quem chama pode usar:
 *   if (await confirmar({...})) { ... }
 *
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string} opcoes.mensagem
 * @param {string} [opcoes.textoConfirmar="Confirmar"]
 * @returns {Promise<boolean>} true se o usuário confirmou.
 */
export function confirmar({ titulo, mensagem, textoConfirmar = "Confirmar" }) {
  const dialogo = obterDialogoConfirmacao();
  dialogo.querySelector('[data-campo="titulo"]').textContent = titulo;
  dialogo.querySelector('[data-campo="mensagem"]').textContent = mensagem;
  dialogo.querySelector('[data-campo="confirmar"]').textContent = textoConfirmar;

  const form = dialogo.querySelector("form");

  return new Promise((resolve) => {
    /**
     * <form method="dialog"> fecha o diálogo quando um botão de envio é clicado.
     * Ouvimos o evento "submit" (disparado na hora do clique) e usamos
     * event.submitter, que é o botão clicado, para saber a escolha.
     * A tecla Esc dispara o evento "cancel" (= cancelar).
     *
     * Por que não o evento "close"? Ele é entregue de forma assíncrona e, em
     * abas em segundo plano, pode atrasar. "submit" e "cancel" são imediatos.
     */
    const finalizar = (confirmou) => {
      form.removeEventListener("submit", aoEnviar);
      dialogo.removeEventListener("cancel", aoCancelar);
      resolve(confirmou);
    };
    const aoEnviar = (evento) => finalizar(evento.submitter?.value === "confirmar");
    const aoCancelar = () => finalizar(false);

    form.addEventListener("submit", aoEnviar);
    dialogo.addEventListener("cancel", aoCancelar);
    dialogo.showModal();
  });
}

/**
 * Mostra ou limpa a mensagem de erro de um campo do formulário.
 * @param {HTMLElement} campo - input/select validado.
 * @param {string} [mensagem] - Vazio limpa o erro.
 */
export function definirErroCampo(campo, mensagem = "") {
  // Convenção: o elemento de erro tem id = "erro-" + id do campo.
  const elementoErro = document.getElementById(`erro-${campo.id}`);
  if (elementoErro) {
    elementoErro.textContent = mensagem;
    elementoErro.hidden = !mensagem;
  }
  campo.classList.toggle("invalido", Boolean(mensagem));
  campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
}

/**
 * Liga/desliga o estado "carregando" de um botão (evita cliques duplicados).
 * @param {HTMLButtonElement} botao
 * @param {boolean} carregando
 * @param {string} [textoCarregando="Salvando..."]
 */
export function definirCarregando(botao, carregando, textoCarregando = "Salvando...") {
  if (carregando) {
    botao.dataset.textoOriginal = botao.textContent;
    botao.textContent = textoCarregando;
  } else if (botao.dataset.textoOriginal) {
    botao.textContent = botao.dataset.textoOriginal;
  }
  botao.disabled = carregando;
  botao.setAttribute("aria-busy", String(carregando));
}

/**
 * DEBOUNCE: adia a execução até o usuário PARAR de disparar o evento.
 * Na pesquisa, sem debounce cada letra digitada faria uma requisição.
 * Com debounce de 300 ms, a busca só acontece após 300 ms sem digitar.
 *
 * Conceito: CLOSURE. A variável "temporizador" fica "guardada" dentro da
 * função devolvida e sobrevive entre uma chamada e outra.
 *
 * @param {Function} funcao
 * @param {number} [esperaMs=300]
 * @returns {Function}
 */
export function debounce(funcao, esperaMs = 300) {
  let temporizador;
  return (...argumentos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => funcao(...argumentos), esperaMs);
  };
}

/**
 * Formata data/hora "AAAA-MM-DD HH:MM:SS" (UTC, como o SQLite grava) para o padrão brasileiro.
 * @param {string|null} valor
 * @returns {string} Ex.: "05/11/2026" ou "—" se vazio.
 */
export function formatarDataHora(valor) {
  if (!valor) return "—";
  const data = new Date(`${valor.replace(" ", "T")}Z`);
  return Number.isNaN(data.getTime()) ? "—" : data.toLocaleDateString("pt-BR");
}
