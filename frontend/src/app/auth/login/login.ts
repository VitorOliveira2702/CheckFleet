import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ConectividadeService } from '../../shared/conectividade.service';
import { Icone } from '../../shared/icone';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Icone],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly auth = inject(AuthService);
  protected readonly conectividade = inject(ConectividadeService);
  private readonly router = inject(Router);

  protected readonly expirou = inject(ActivatedRoute).snapshot.queryParamMap.has('expirou');
  protected readonly erroGoogle = signal<string | null>(null);

  // Login com e-mail e senha: o mesmo formulário serve para entrar e para criar a conta.
  protected readonly criandoConta = signal(false);
  protected readonly enviando = signal(false);
  protected readonly erroSenha = signal<string | null>(null);
  protected nome = '';
  protected email = '';
  protected senha = '';

  private readonly botaoGoogle = viewChild<ElementRef<HTMLElement>>('botaoGoogle');

  constructor() {
    if (this.auth.logado()) {
      this.router.navigate(['/painel']);
      return;
    }
    // afterNextRender: espera o HTML existir na tela para o Google desenhar o botão dentro dele.
    afterNextRender(() => this.mostrarBotaoGoogle());
  }

  protected mostrarBotaoGoogle(): void {
    const elemento = this.botaoGoogle()?.nativeElement;
    if (!elemento || !this.auth.configurado) return;

    this.erroGoogle.set(null);
    this.auth
      .renderizarBotao(elemento, () => this.router.navigate(['/painel']))
      .catch(() => this.erroGoogle.set('Sem conexão com o Google. Conecte-se à internet para fazer o primeiro login.'));
  }

  protected alternarModo(): void {
    this.criandoConta.update((v) => !v);
    this.erroSenha.set(null);
  }

  protected async enviar(): Promise<void> {
    this.enviando.set(true);
    this.erroSenha.set(null);
    try {
      if (this.criandoConta()) {
        await this.auth.cadastrar(this.nome, this.email, this.senha);
      } else {
        await this.auth.entrar(this.email, this.senha);
      }
      this.router.navigate(['/painel']);
    } catch (erro) {
      this.erroSenha.set((erro as Error).message);
    } finally {
      this.enviando.set(false);
    }
  }
}
