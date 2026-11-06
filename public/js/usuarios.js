/**
 * TELA DE USUÁRIOS (frontend)
 * ---------------------------
 * Responsabilidades:
 *   - listar usuários com pesquisa, filtro de situação e paginação;
 *   - abrir o modal para cadastrar ou editar;
 *   - validar o formulário antes de enviar;
 *   - inativar usuários (com confirmação).
 *
 * Fluxo de dados:
 *   tela → api() → /api/usuarios (Express) → usuarioService → SQLite
 *   e a resposta faz o caminho de volta até ser desenhada na tabela.
 */
import { api, ErroApi } from "./api.js";
import { sessaoPronta } from "./layout.js";
import { mostrarToast, confirmar, definirErroCampo, definirCarregando, debounce } from "./ui.js";

// ---------- Elementos da tela ----------
const corpoTabela = document.getElementById("corpoTabelaUsuarios");
const semUsuarios = document.getElementById("semUsuarios");
const campoPesquisa = document.getElementById("pesquisaUsuario");
const filtroStatus = document.getElementById("filtroStatusUsuario");
const infoPaginacao = document.getElementById("infoPaginacao");
const btnAnterior = document.getElementById("btnPaginaAnterior");
const btnProxima = document.getElementById("btnProximaPagina");

const modal = document.getElementById("modalUsuario");
const form = document.getElementById("formUsuario");
const tituloModal = document.getElementById("tituloModalUsuario");
const erroFormulario = document.getElementById("erroFormularioUsuario");
const btnSalvar = document.getElementById("btnSalvarUsuario");
const dicaSenha = document.getElementById("dicaSenha");

const campos = {
  nomeCompleto: document.getElementById("nome"),
  email: document.getElementById("email"),
  usuario: document.getElementById("usuarioLogin"),
  senha: document.getElementById("senhaUsuario"),
  confirmarSenha: document.getElementById("confirmarSenha"),
  perfil: document.getElementById("perfil"),
  ativo: document.getElementById("status")
};

const ROTULOS_PERFIL = { admin: "Administrador", comum: "Usuário comum" };

/**
 * ESTADO da tela: os dados que, quando mudam, exigem redesenhar algo.
 * Manter tudo em um objeto deixa claro "do que a tela depende".
 */
const estado = {
  pagina: 1,
  totalPaginas: 1,
  usuarioEmEdicao: null, // null = cadastro; objeto = edição
  idLogado: null
};

// ---------- Listagem ----------

/**
 * Busca a página atual de usuários na API, aplicando pesquisa e filtro.
 * URLSearchParams monta a query string com os caracteres especiais codificados
 * (ex.: espaço vira %20), evitando URLs quebradas.
 */
async function carregarUsuarios() {
  const parametros = new URLSearchParams({
    busca: campoPesquisa.value.trim(),
    status: filtroStatus.value,
    pagina: String(estado.pagina),
    limite: "10"
  });

  try {
    const resposta = await api(`/api/usuarios?${parametros}`);

    // Se um filtro reduziu o total e a página atual deixou de existir, volta uma página.
    if (resposta.itens.length === 0 && estado.pagina > 1) {
      estado.pagina = resposta.totalPaginas;
      return carregarUsuarios();
    }

    estado.totalPaginas = resposta.totalPaginas;
    renderizarTabela(resposta.itens);
    renderizarPaginacao(resposta);
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao carregar usuários.", "erro");
  }
}

/**
 * Cria uma célula <td> com texto seguro e o rótulo usado no layout mobile.
 * @param {string} rotulo - Nome da coluna (vira data-rotulo).
 * @param {string|Node} conteudo - Texto ou elemento.
 * @returns {HTMLTableCellElement}
 */
function criarCelula(rotulo, conteudo) {
  const td = document.createElement("td");
  td.dataset.rotulo = rotulo;
  if (conteudo instanceof Node) {
    td.appendChild(conteudo);
  } else {
    td.textContent = conteudo; // textContent: protege contra XSS
  }
  return td;
}

/**
 * Cria uma etiqueta colorida (perfil ou situação).
 * @param {string} texto
 * @param {string} variacao - Sufixo da classe CSS (ativo, inativo, admin, comum).
 * @param {string} dataTest
 * @returns {HTMLSpanElement}
 */
function criarEtiqueta(texto, variacao, dataTest) {
  const span = document.createElement("span");
  span.className = `etiqueta etiqueta-${variacao}`;
  span.dataset.test = dataTest;
  span.textContent = texto;
  return span;
}

/**
 * Cria um botão de ação da linha.
 * @param {string} texto
 * @param {string} classes
 * @param {string} dataTest
 * @param {Function} aoClicar
 * @returns {HTMLButtonElement}
 */
function criarBotao(texto, classes, dataTest, aoClicar) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = `btn btn-pequeno ${classes}`;
  botao.dataset.test = dataTest;
  botao.textContent = texto;
  botao.addEventListener("click", aoClicar);
  return botao;
}

/**
 * Desenha as linhas da tabela.
 *
 * Cada <tr> recebe data-test="linha-usuario" e data-id com o id do usuário.
 * No Cypress, isso permite achar a linha certa e clicar no botão DELA:
 *   cy.contains('[data-test="linha-usuario"]', 'maria').find('[data-test="btn-editar-usuario"]').click()
 *
 * @param {object[]} usuarios
 */
function renderizarTabela(usuarios) {
  corpoTabela.replaceChildren();
  semUsuarios.hidden = usuarios.length > 0;

  for (const usuario of usuarios) {
    const tr = document.createElement("tr");
    tr.dataset.test = "linha-usuario";
    tr.dataset.id = String(usuario.id);

    const acoes = document.createElement("div");
    acoes.className = "acoes-tabela";
    acoes.appendChild(criarBotao("Editar", "btn-secundario", "btn-editar-usuario", () => abrirModal(usuario)));

    // Não mostramos "Inativar" para quem já está inativo nem para o próprio usuário logado.
    // (O backend também bloqueia; aqui é só para não oferecer uma ação impossível.)
    if (usuario.ativo && usuario.id !== estado.idLogado) {
      acoes.appendChild(criarBotao("Inativar", "btn-contorno-perigo", "btn-inativar-usuario", () => inativarUsuario(usuario)));
    }

    tr.append(
      criarCelula("Nome", usuario.nomeCompleto || "—"),
      criarCelula("Usuário", usuario.usuario),
      criarCelula("E-mail", usuario.email || "—"),
      criarCelula("Perfil", criarEtiqueta(ROTULOS_PERFIL[usuario.perfil] || usuario.perfil, usuario.perfil, "perfil-usuario")),
      criarCelula("Situação", criarEtiqueta(usuario.ativo ? "Ativo" : "Inativo", usuario.ativo ? "ativo" : "inativo", "status-usuario")),
      criarCelula("Ações", acoes)
    );
    corpoTabela.appendChild(tr);
  }
}

/**
 * Atualiza o texto e os botões da paginação.
 * @param {{ total: number, pagina: number, totalPaginas: number }} resposta
 */
function renderizarPaginacao({ total, pagina, totalPaginas }) {
  infoPaginacao.textContent = `${total} usuário(s) · Página ${pagina} de ${totalPaginas}`;
  btnAnterior.disabled = pagina <= 1;
  btnProxima.disabled = pagina >= totalPaginas;
}

// ---------- Formulário (modal) ----------

/**
 * Limpa todos os erros exibidos no formulário.
 */
function limparErros() {
  Object.values(campos).forEach((campo) => definirErroCampo(campo));
  erroFormulario.hidden = true;
  erroFormulario.textContent = "";
}

/**
 * Abre o modal em modo CADASTRO (sem argumento) ou EDIÇÃO (com o usuário).
 * @param {object|null} [usuario=null]
 */
function abrirModal(usuario = null) {
  estado.usuarioEmEdicao = usuario;
  form.reset();
  limparErros();

  const edicao = Boolean(usuario);
  tituloModal.textContent = edicao ? "Editar usuário" : "Novo usuário";

  // Na edição a senha é opcional: escondemos os asteriscos e mudamos a dica.
  document.querySelectorAll('[data-campo="senha-obrigatoria"]').forEach((el) => { el.hidden = edicao; });
  dicaSenha.textContent = edicao
    ? "Deixe em branco para manter a senha atual."
    : "Mínimo de 8 caracteres, com letras e números.";

  if (edicao) {
    campos.nomeCompleto.value = usuario.nomeCompleto || "";
    campos.email.value = usuario.email || "";
    campos.usuario.value = usuario.usuario;
    campos.perfil.value = usuario.perfil;
    campos.ativo.value = usuario.ativo ? "ativo" : "inativo";
  }

  modal.showModal();
  campos.nomeCompleto.focus();
}

/**
 * Lê os valores do formulário em um objeto no formato esperado pela API.
 * @returns {object}
 */
function lerFormulario() {
  return {
    nomeCompleto: campos.nomeCompleto.value.trim(),
    email: campos.email.value.trim(),
    usuario: campos.usuario.value.trim(),
    senha: campos.senha.value,
    confirmarSenha: campos.confirmarSenha.value,
    perfil: campos.perfil.value,
    ativo: campos.ativo.value
  };
}

/**
 * Validação no navegador (espelha as regras do backend para dar retorno rápido).
 * @param {object} dados - Resultado de lerFormulario().
 * @returns {boolean} true se não há erros.
 */
function validarFormulario(dados) {
  const edicao = Boolean(estado.usuarioEmEdicao);
  const erros = {};

  if (dados.nomeCompleto.length < 3) erros.nomeCompleto = "Informe o nome completo (mínimo 3 caracteres).";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dados.email)) erros.email = "Informe um e-mail válido.";
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(dados.usuario)) {
    erros.usuario = "Use de 3 a 30 caracteres: letras, números, ponto, hífen ou sublinhado.";
  }

  const informouSenha = dados.senha !== "" || dados.confirmarSenha !== "";
  if (!edicao || informouSenha) {
    if (!dados.senha) {
      erros.senha = "Informe a senha.";
    } else if (dados.senha.length < 8 || !/[a-zA-Z]/.test(dados.senha) || !/\d/.test(dados.senha)) {
      erros.senha = "A senha deve ter no mínimo 8 caracteres, com letras e números.";
    }
    if (!erros.senha && dados.senha !== dados.confirmarSenha) {
      erros.confirmarSenha = "A confirmação de senha não confere.";
    }
  }

  if (!dados.perfil) erros.perfil = "Selecione o perfil de acesso.";

  // Mostra (ou limpa) o erro de cada campo.
  Object.entries(campos).forEach(([nome, campo]) => definirErroCampo(campo, erros[nome]));

  // Foca o primeiro campo com erro.
  const primeiroComErro = Object.keys(erros)[0];
  if (primeiroComErro) campos[primeiroComErro].focus();

  return !primeiroComErro;
}

/**
 * Envia o formulário: POST para cadastrar, PUT para editar.
 * @param {SubmitEvent} evento
 */
async function salvarUsuario(evento) {
  evento.preventDefault();
  limparErros();

  const dados = lerFormulario();
  if (!validarFormulario(dados)) return;

  const edicao = Boolean(estado.usuarioEmEdicao);
  const url = edicao ? `/api/usuarios/${estado.usuarioEmEdicao.id}` : "/api/usuarios";

  definirCarregando(btnSalvar, true);
  try {
    await api(url, { metodo: edicao ? "PUT" : "POST", corpo: dados });
    modal.close();
    mostrarToast(edicao ? "Usuário atualizado com sucesso." : "Usuário cadastrado com sucesso.");
    await carregarUsuarios();
  } catch (erro) {
    // Erros do backend (duplicidade 409, regras de negócio 400...) aparecem no topo do formulário.
    erroFormulario.textContent = erro instanceof ErroApi ? erro.erros.join(" ") : "Erro ao salvar usuário.";
    erroFormulario.hidden = false;
  } finally {
    // finally roda sempre, com sucesso ou erro: o botão nunca fica travado.
    definirCarregando(btnSalvar, false);
  }
}

/**
 * Inativa um usuário após confirmação.
 * @param {object} usuario
 */
async function inativarUsuario(usuario) {
  const confirmou = await confirmar({
    titulo: "Inativar usuário",
    mensagem: `Deseja inativar "${usuario.nomeCompleto || usuario.usuario}"? Ele não conseguirá mais acessar o sistema. É possível reativá-lo depois pela edição.`,
    textoConfirmar: "Inativar"
  });
  if (!confirmou) return;

  try {
    await api(`/api/usuarios/${usuario.id}/inativar`, { metodo: "PATCH" });
    mostrarToast("Usuário inativado com sucesso.");
    await carregarUsuarios();
  } catch (erro) {
    mostrarToast(erro instanceof ErroApi ? erro.message : "Erro ao inativar usuário.", "erro");
  }
}

// ---------- Eventos ----------

document.getElementById("btnNovoUsuario").addEventListener("click", () => abrirModal());
document.getElementById("btnCancelarUsuario").addEventListener("click", () => modal.close());
form.addEventListener("submit", salvarUsuario);

// Ao digitar em um campo, o erro dele some.
Object.values(campos).forEach((campo) => {
  campo.addEventListener("input", () => definirErroCampo(campo));
});

// Pesquisa com debounce: só busca 300 ms depois que o usuário para de digitar.
campoPesquisa.addEventListener("input", debounce(() => {
  estado.pagina = 1; // nova pesquisa sempre começa da primeira página
  carregarUsuarios();
}));

filtroStatus.addEventListener("change", () => {
  estado.pagina = 1;
  carregarUsuarios();
});

btnAnterior.addEventListener("click", () => {
  estado.pagina = Math.max(1, estado.pagina - 1);
  carregarUsuarios();
});

btnProxima.addEventListener("click", () => {
  estado.pagina = Math.min(estado.totalPaginas, estado.pagina + 1);
  carregarUsuarios();
});

// ---------- Inicialização ----------
// Espera saber quem está logado (para esconder o "Inativar" da própria linha)
// e então carrega a primeira página.
sessaoPronta
  .then((usuario) => { estado.idLogado = usuario.id; })
  .catch(() => {})
  .finally(carregarUsuarios);
