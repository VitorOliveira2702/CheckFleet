import { Injectable, computed, signal } from '@angular/core';
import { GOOGLE_CLIENT_ID } from './auth.config';

export interface Usuario {
  nome: string;
  email: string;
  foto: string;
  /** ID token (JWT) do Google, enviado à API no cabeçalho Authorization. */
  token: string;
}

// O script do Google cria o objeto global `google`; só usamos estas duas funções.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (r: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, options: Record<string, unknown>): void;
          disableAutoSelect(): void;
        };
      };
    };
  }
}

const CHAVE_STORAGE = 'checkfleet.usuario';

/**
 * Login com Google (Google Identity Services).
 *
 * O usuário fica salvo no localStorage. Assim, depois do primeiro login, o app
 * abre normalmente mesmo sem internet (requisito de disponibilidade offline);
 * o token só é conferido de verdade quando a API é chamada.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<Usuario | null>(this.lerDoStorage());
  readonly logado = computed(() => this.usuario() !== null);
  readonly configurado = !GOOGLE_CLIENT_ID.startsWith('SEU_CLIENT_ID');

  private scriptCarregado?: Promise<void>;

  /** Carrega o script do Google e desenha o botão "Fazer login com o Google". */
  async renderizarBotao(elemento: HTMLElement, aoLogar: () => void): Promise<void> {
    await this.carregarScript();
    const google = window.google!;
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resposta) => {
        this.salvar(resposta.credential);
        aoLogar();
      },
    });
    google.accounts.id.renderButton(elemento, {
      theme: 'filled_blue',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: Math.min(elemento.clientWidth || 320, 400),
      locale: 'pt-BR',
    });
  }

  sair(): void {
    localStorage.removeItem(CHAVE_STORAGE);
    this.usuario.set(null);
    window.google?.accounts.id.disableAutoSelect();
  }

  private salvar(token: string): void {
    // O JWT tem 3 partes separadas por ponto; a do meio (payload) traz nome,
    // e-mail e foto em base64url. Aqui só lemos para exibir — quem valida a
    // assinatura é o backend.
    const payload = JSON.parse(decodificarBase64Url(token.split('.')[1]));
    const usuario: Usuario = {
      nome: payload.name ?? payload.email,
      email: payload.email,
      foto: payload.picture ?? '',
      token,
    };
    localStorage.setItem(CHAVE_STORAGE, JSON.stringify(usuario));
    this.usuario.set(usuario);
  }

  private lerDoStorage(): Usuario | null {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      return salvo ? (JSON.parse(salvo) as Usuario) : null;
    } catch {
      return null;
    }
  }

  private carregarScript(): Promise<void> {
    this.scriptCarregado ??= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.scriptCarregado = undefined; // permite tentar de novo quando voltar a conexão
        reject(new Error('Não foi possível carregar o login do Google.'));
      };
      document.head.appendChild(script);
    });
    return this.scriptCarregado;
  }
}

function decodificarBase64Url(texto: string): string {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes); // TextDecoder preserva acentos no nome
}
