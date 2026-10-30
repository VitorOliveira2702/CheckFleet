import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ConectividadeService } from '../../shared/conectividade.service';
import { Icone } from '../../shared/icone';

@Component({
  selector: 'app-login',
  imports: [Icone],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  protected readonly auth = inject(AuthService);
  protected readonly conectividade = inject(ConectividadeService);
  private readonly router = inject(Router);

  protected readonly expirou = inject(ActivatedRoute).snapshot.queryParamMap.has('expirou');
  protected readonly erro = signal<string | null>(null);

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

    this.erro.set(null);
    this.auth
      .renderizarBotao(elemento, () => this.router.navigate(['/painel']))
      .catch(() => this.erro.set('Sem conexão com o Google. Conecte-se à internet para fazer o primeiro login.'));
  }
}
