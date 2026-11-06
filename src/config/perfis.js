/**
 * PERFIS DE ACESSO
 * ----------------
 * Lista única dos perfis do sistema. Usar constantes em vez de escrever
 * "admin" solto pelo código evita erros de digitação ("Admin", "adm"...) e
 * deixa em um só lugar o que precisa mudar se surgir um perfil novo.
 *
 * O que cada perfil pode fazer:
 * - ADMIN: tudo, inclusive gerenciar usuários.
 * - COMUM: mensalidades e jogadores; NÃO gerencia usuários.
 */
const PERFIS = Object.freeze({
  ADMIN: "admin",
  COMUM: "comum"
});

// Object.freeze impede alterações acidentais (PERFIS.ADMIN = "x" não tem efeito).
const PERFIS_VALIDOS = Object.freeze(Object.values(PERFIS));

module.exports = { PERFIS, PERFIS_VALIDOS };
