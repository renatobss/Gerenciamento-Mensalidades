/**
 * TELA DE LOGIN (frontend)
 * ------------------------
 * Fluxo:
 *   1. O usuário preenche os campos e envia o formulário.
 *   2. Validamos no navegador (campos obrigatórios), para dar retorno rápido.
 *   3. Enviamos POST /api/login com fetch().
 *   4. O backend valida DE NOVO (a validação do frontend pode ser burlada),
 *      confere o hash da senha e cria a sessão.
 *   5. Sucesso → vamos para o sistema. Erro → mostramos uma mensagem amigável.
 */

// Referências aos elementos da tela, buscadas uma única vez.
const formLogin = document.getElementById("formLogin");
const campoUsuario = document.getElementById("usuario");
const campoSenha = document.getElementById("senha");
const erroUsuario = document.getElementById("erroUsuario");
const erroSenha = document.getElementById("erroSenha");
const mensagemErro = document.getElementById("mensagemErroLogin");
const mensagemInfo = document.getElementById("mensagemInfoLogin");
const btnLogin = document.getElementById("btnLogin");
const btnTexto = btnLogin.querySelector(".btn-texto");
const btnVisualizarSenha = document.getElementById("btnVisualizarSenha");

/**
 * Mensagens amigáveis por status HTTP. Centralizar facilita a manutenção e
 * deixa claro, para quem testa, qual texto esperar em cada situação.
 */
const MENSAGENS_POR_STATUS = {
  401: "Usuário ou senha incorretos. Verifique e tente novamente.",
  500: "Não foi possível entrar agora. Tente novamente em instantes."
};
const MENSAGEM_SEM_CONEXAO = "Não foi possível conectar ao servidor. Verifique sua conexão.";

/**
 * Mostra ou limpa o erro de um campo específico.
 * aria-invalid avisa os leitores de tela que o campo está com problema.
 *
 * @param {HTMLInputElement} campo - O input validado.
 * @param {HTMLElement} elementoErro - O parágrafo onde a mensagem aparece.
 * @param {string} [mensagem] - Texto do erro; vazio/ausente limpa o erro.
 */
function definirErroCampo(campo, elementoErro, mensagem = "") {
  elementoErro.textContent = mensagem;
  elementoErro.hidden = !mensagem;
  campo.classList.toggle("invalido", Boolean(mensagem));
  campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
}

/**
 * Exibe (ou esconde, se o texto for vazio) a mensagem geral de erro.
 * @param {string} [texto]
 */
function mostrarErroGeral(texto = "") {
  mensagemErro.textContent = texto;
  mensagemErro.hidden = !texto;
}

/**
 * Valida os campos obrigatórios.
 * @returns {boolean} true se o formulário pode ser enviado.
 */
function validarFormulario() {
  const usuarioVazio = campoUsuario.value.trim() === "";
  const senhaVazia = campoSenha.value === "";

  definirErroCampo(campoUsuario, erroUsuario, usuarioVazio ? "Informe o usuário." : "");
  definirErroCampo(campoSenha, erroSenha, senhaVazia ? "Informe a senha." : "");

  // Coloca o cursor no primeiro campo com problema (boa prática de usabilidade).
  if (usuarioVazio) {
    campoUsuario.focus();
  } else if (senhaVazia) {
    campoSenha.focus();
  }

  return !usuarioVazio && !senhaVazia;
}

/**
 * Liga/desliga o estado "carregando" do botão. Durante a requisição o botão
 * fica desabilitado, o que impede envios duplicados com cliques repetidos.
 * @param {boolean} carregando
 */
function definirCarregando(carregando) {
  btnLogin.disabled = carregando;
  btnLogin.classList.toggle("carregando", carregando);
  btnLogin.setAttribute("aria-busy", String(carregando));
  btnTexto.textContent = carregando ? "Entrando..." : "Entrar";
}

/**
 * Alterna a senha entre visível (type="text") e oculta (type="password").
 * aria-pressed e aria-label mantêm o botão acessível para leitores de tela.
 */
function alternarVisibilidadeSenha() {
  const vaiMostrar = campoSenha.type === "password";

  campoSenha.type = vaiMostrar ? "text" : "password";
  btnVisualizarSenha.setAttribute("aria-pressed", String(vaiMostrar));
  btnVisualizarSenha.setAttribute("aria-label", vaiMostrar ? "Ocultar senha" : "Mostrar senha");
  // Troca o ícone. Elementos SVG não têm a propriedade ".hidden" (só elementos
  // HTML têm), por isso manipulamos o ATRIBUTO diretamente com toggleAttribute.
  btnVisualizarSenha.querySelector('[data-icone="mostrar"]').toggleAttribute("hidden", vaiMostrar);
  btnVisualizarSenha.querySelector('[data-icone="ocultar"]').toggleAttribute("hidden", !vaiMostrar);
  campoSenha.focus();
}

/**
 * Envia as credenciais para a API.
 * Conceito: async/await. "await" pausa ESTA função até a resposta chegar,
 * sem travar a página, e o código fica legível de cima para baixo.
 *
 * @param {SubmitEvent} evento
 */
async function enviarLogin(evento) {
  evento.preventDefault(); // impede o recarregamento padrão da página
  mostrarErroGeral();
  mensagemInfo.hidden = true;

  if (!validarFormulario()) {
    return;
  }

  definirCarregando(true);

  try {
    const resposta = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Atenção: a senha NÃO leva trim(). Espaços podem fazer parte dela.
      body: JSON.stringify({ usuario: campoUsuario.value.trim(), senha: campoSenha.value })
    });

    if (resposta.ok) {
      window.location.href = "/";
      return; // mantém o botão em "Entrando..." até a nova página carregar
    }

    // 400 e 429 trazem mensagens específicas do backend; os demais usam as nossas.
    const dados = await resposta.json().catch(() => ({}));
    const mensagemBackend = Array.isArray(dados.erros) ? dados.erros.join(" ") : "";
    const mensagem = [400, 429].includes(resposta.status) && mensagemBackend
      ? mensagemBackend
      : MENSAGENS_POR_STATUS[resposta.status] || MENSAGENS_POR_STATUS[500];

    mostrarErroGeral(mensagem);

    // Em caso de credenciais inválidas, limpa a senha para nova digitação.
    if (resposta.status === 401) {
      campoSenha.value = "";
      campoSenha.focus();
    }
  } catch (erro) {
    // fetch só cai aqui em falha de rede (servidor fora do ar, sem internet).
    mostrarErroGeral(MENSAGEM_SEM_CONEXAO);
  }

  definirCarregando(false);
}

/**
 * Se a página de login foi aberta porque a sessão expirou, avisamos o usuário.
 * O parâmetro vem na URL: /login.html?sessao=expirada (enviado pelo app.js).
 */
function mostrarAvisoSessaoExpirada() {
  const parametros = new URLSearchParams(window.location.search);

  if (parametros.get("sessao") === "expirada") {
    mensagemInfo.textContent = "Sua sessão expirou. Entre novamente para continuar.";
    mensagemInfo.hidden = false;
  }
}

// ---- Registro dos eventos ----
formLogin.addEventListener("submit", enviarLogin);
btnVisualizarSenha.addEventListener("click", alternarVisibilidadeSenha);

// Ao digitar, o erro daquele campo some (retorno imediato ao usuário).
campoUsuario.addEventListener("input", () => definirErroCampo(campoUsuario, erroUsuario));
campoSenha.addEventListener("input", () => definirErroCampo(campoSenha, erroSenha));

mostrarAvisoSessaoExpirada();
campoUsuario.focus();
