import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GOOGLE_CLIENT_ID } from './auth.config';

export interface Usuario {
  nome: string;
  email: string;
  foto: string;
  /** Token (JWT) enviado à API no cabeçalho Authorization: do Google ou emitido pela API. */
  token: string;
  /** Como a pessoa entrou. Usuários salvos antes do login com senha não têm o campo: são do Google. */
  provedor?: 'google' | 'senha';
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
const API_AUTH = 'http://localhost:8080/api/auth';
/** Emissor dos tokens do login com senha (o mesmo do TokenService da API). */
const EMISSOR_API = 'checkfleet-api';

/**
 * Login com Google (Google Identity Services) ou com e-mail e senha.
 *
 * Os dois terminam igual: um token (JWT) com nome e e-mail, que vai em toda
 * chamada à API. Muda só quem emite o token: o Google ou a própria API.
 *
 * O usuário fica salvo no localStorage. Assim, depois do primeiro login, o app
 * abre normalmente mesmo sem internet (requisito de disponibilidade offline);
 * o token só é conferido de verdade quando a API é chamada.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

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

  /** Login com e-mail e senha. Lança um erro com a mensagem para a tela se não der certo. */
  async entrar(email: string, senha: string): Promise<void> {
    await this.pedirToken(`${API_AUTH}/login`, { email, senha });
  }

  /** Cria a conta e já entra com ela. */
  async cadastrar(nome: string, email: string, senha: string): Promise<void> {
    await this.pedirToken(`${API_AUTH}/cadastro`, { nome, email, senha });
  }

  sair(): void {
    localStorage.removeItem(CHAVE_STORAGE);
    this.usuario.set(null);
    window.google?.accounts.id.disableAutoSelect();
  }

  private async pedirToken(url: string, corpo: object): Promise<void> {
    try {
      const resposta = await firstValueFrom(this.http.post<{ token: string }>(url, corpo));
      this.salvar(resposta.token);
    } catch (erro) {
      throw new Error(mensagemDeErro(erro));
    }
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
      provedor: payload.iss === EMISSOR_API ? 'senha' : 'google',
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

/** Traduz a resposta de erro da API para uma mensagem que o inspetor entenda. */
function mensagemDeErro(erro: unknown): string {
  if (!(erro instanceof HttpErrorResponse)) return 'Não foi possível entrar. Tente novamente.';
  switch (erro.status) {
    case 401:
      return 'E-mail ou senha inválidos.';
    case 409:
      return 'Este e-mail já está cadastrado. Use a opção Entrar.';
    case 400:
      return 'Confira os dados: informe um e-mail válido e uma senha com pelo menos 8 caracteres.';
    case 0:
    case 504: // resposta do Service Worker quando o servidor não responde
      return 'Sem conexão com o servidor. O primeiro login precisa de internet.';
    default:
      return 'O servidor não conseguiu concluir o login. Tente novamente.';
  }
}

function decodificarBase64Url(texto: string): string {
  const base64 = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes); // TextDecoder preserva acentos no nome
}
