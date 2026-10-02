/**
 * Convite pendente do navegador.
 *
 * Quem abre o link do convite ainda não tem conta nem sessão: ele passa por
 * login/cadastro e só depois deve voltar ao convite. O token ficava só no
 * sessionStorage, que é por aba — se a pessoa abria o link no navegador interno
 * do WhatsApp e terminava o cadastro em outra aba ou outro navegador, o convite
 * se perdia e ela caía na tela de "criar workspace", sem entender o que
 * aconteceu.
 *
 * Agora o token fica nos dois lugares: sessionStorage (chave antiga, que outras
 * telas ainda leem) e localStorage com validade de 7 dias, igual à do convite.
 */

const CHAVE_SESSION = 'pending_invite_token';
const CHAVE_LOCAL = 'flowalt_pending_invite';
const VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;

export interface ConvitePendente {
  token: string;
  email?: string;
}

interface RegistroLocal {
  token: string;
  email?: string;
  ts: number;
}

function lerLocal(): RegistroLocal | null {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return null;
    const registro = JSON.parse(bruto) as RegistroLocal;
    if (!registro?.token || Date.now() - registro.ts > VALIDADE_MS) {
      localStorage.removeItem(CHAVE_LOCAL);
      return null;
    }
    return registro;
  } catch {
    return null;
  }
}

export function salvarConvitePendente(token: string, email?: string): void {
  try {
    sessionStorage.setItem(CHAVE_SESSION, token);
  } catch {
    /* navegador sem sessionStorage: o localStorage cobre */
  }
  try {
    const registro: RegistroLocal = { token, email: email?.trim().toLowerCase(), ts: Date.now() };
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(registro));
  } catch {
    /* modo privado: segue só com o sessionStorage */
  }
}

export function lerConvitePendente(): ConvitePendente | null {
  let doSession: string | null = null;
  try {
    doSession = sessionStorage.getItem(CHAVE_SESSION);
  } catch {
    doSession = null;
  }
  const local = lerLocal();

  if (doSession) {
    return { token: doSession, email: local?.token === doSession ? local.email : undefined };
  }
  return local ? { token: local.token, email: local.email } : null;
}

export function limparConvitePendente(): void {
  try {
    sessionStorage.removeItem(CHAVE_SESSION);
  } catch {
    /* ignora */
  }
  try {
    localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    /* ignora */
  }
}
