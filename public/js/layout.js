/**
 * LAYOUT COMPARTILHADO (menu lateral)
 * -----------------------------------
 * Todas as páginas internas têm um <aside id="menuLateral"> vazio. Este módulo:
 *   1. busca o usuário logado (GET /api/sessao);
 *   2. desenha o menu lateral SÓ com as opções permitidas para o perfil;
 *   3. destaca a página atual;
 *   4. controla a abertura do menu no celular (botão "hambúrguer").
 *
 * Por que gerar o menu via JavaScript? Sem um framework, cada página HTML
 * teria uma cópia do menu, e qualquer mudança exigiria editar todas.
 * Assim, o menu existe em um único lugar.
 *
 * IMPORTANTE: esconder um item do menu é só conforto visual. Quem garante a
 * permissão é o backend (middleware exigirPerfil).
 */
import { api } from "./api.js";

/**
 * Itens do menu. "perfis" vazio = todos os perfis veem o item.
 * "dataTest" segue o padrão: menu-<nome>.
 */
const ITENS_MENU = [
  { href: "/", rotulo: "Mensalidades", icone: "💰", dataTest: "menu-mensalidades", perfis: [], paginas: ["/", "/index.html"] },
  { href: "/jogadores.html", rotulo: "Jogadores", icone: "👟", dataTest: "menu-jogadores", perfis: [], paginas: ["/jogadores.html"] },
  { href: "/usuarios.html", rotulo: "Usuários", icone: "👤", dataTest: "menu-usuarios", perfis: ["admin"], paginas: ["/usuarios.html"] }
];

const ROTULOS_PERFIL = { admin: "Administrador", comum: "Usuário comum" };

/**
 * Promise com o usuário logado, criada uma única vez quando o módulo carrega.
 * Outras telas podem importá-la sem refazer a requisição:
 *   import { sessaoPronta } from "./layout.js";
 *   const usuario = await sessaoPronta;
 * (Módulos ES são executados uma só vez por página, então todos recebem a mesma Promise.)
 */
export const sessaoPronta = api("/api/sessao").then((dados) => dados.usuario);

/**
 * Cria um elemento HTML com classe e texto de forma segura (textContent).
 * @param {string} tag
 * @param {string} [classe]
 * @param {string} [texto]
 * @returns {HTMLElement}
 */
function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/**
 * Desenha o menu lateral para o usuário informado.
 * @param {{ nomeCompleto: string|null, usuario: string, perfil: string }} usuario
 */
function renderizarMenu(usuario) {
  const menu = document.getElementById("menuLateral");
  if (!menu) return;

  menu.replaceChildren(); // limpa o conteúdo anterior

  // Marca
  const marca = criarElemento("a", "sidebar-marca");
  marca.href = "/";
  marca.append(criarElemento("span", "sidebar-marca-icone", "⚽"), criarElemento("span", "", "Mensalidades FC"));

  // Navegação filtrada pelo perfil
  const nav = criarElemento("nav", "sidebar-nav");
  nav.setAttribute("aria-label", "Menu principal");
  const paginaAtual = window.location.pathname;

  ITENS_MENU
    .filter((item) => item.perfis.length === 0 || item.perfis.includes(usuario.perfil))
    .forEach((item) => {
      const link = criarElemento("a", "sidebar-link");
      link.href = item.href;
      link.dataset.test = item.dataTest;
      link.append(criarElemento("span", "sidebar-link-icone", item.icone), criarElemento("span", "", item.rotulo));
      if (item.paginas.includes(paginaAtual)) {
        link.classList.add("ativo");
        link.setAttribute("aria-current", "page"); // acessibilidade: "você está aqui"
      }
      nav.appendChild(link);
    });

  // Rodapé com o usuário logado e o botão Sair
  const rodape = criarElemento("div", "sidebar-rodape");
  const info = criarElemento("div", "sidebar-usuario");
  info.dataset.test = "usuario-logado";
  info.append(
    criarElemento("strong", "", usuario.nomeCompleto || usuario.usuario),
    criarElemento("span", "", ROTULOS_PERFIL[usuario.perfil] || usuario.perfil)
  );
  const sair = criarElemento("a", "sidebar-sair", "Sair");
  sair.href = "/api/logout";
  sair.dataset.test = "btn-sair";
  rodape.append(info, sair);

  menu.append(marca, nav, rodape);
}

/**
 * Liga o botão "hambúrguer" que abre/fecha o menu no celular.
 * A classe "menu-aberto" no <body> é que mostra o menu (veja o CSS).
 */
function configurarMenuMobile() {
  const botao = document.querySelector('[data-test="btn-menu"]');
  const fundo = document.querySelector(".sidebar-fundo");
  if (!botao) return;

  const alternar = (abrir) => {
    document.body.classList.toggle("menu-aberto", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
  };

  botao.addEventListener("click", () => alternar(!document.body.classList.contains("menu-aberto")));
  if (fundo) fundo.addEventListener("click", () => alternar(false));
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") alternar(false);
  });
}

configurarMenuMobile();
sessaoPronta.then(renderizarMenu).catch(() => {
  // Se a sessão não carregar (ex.: falha de rede), o menu fica vazio;
  // a própria tela mostrará o erro ao tentar buscar seus dados.
});
