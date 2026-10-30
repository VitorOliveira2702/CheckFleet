import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { ConectividadeService } from '../shared/conectividade.service';
import { Icone } from '../shared/icone';

@Component({
  selector: 'app-perfil',
  imports: [Icone],
  template: `
    <div class="pagina">
      <h1 class="titulo-tela">Perfil</h1>

      @if (auth.usuario(); as u) {
        <section class="card usuario">
          @if (u.foto) {
            <img class="avatar" [src]="u.foto" alt="" referrerpolicy="no-referrer" />
          } @else {
            <span class="avatar"><app-icone nome="usuario" /></span>
          }
          <div>
            <p class="titulo-secao">{{ u.nome }}</p>
            <p class="muted">{{ u.email }}</p>
          </div>
        </section>
      }

      <section class="card pilha">
        <h2 class="titulo-secao">Conexão</h2>
        @if (conectividade.online()) {
          <span class="chip chip-success"><app-icone nome="online" [tamanho]="16" /> Online</span>
        } @else {
          <span class="chip chip-offline"><app-icone nome="offline" [tamanho]="16" /> Offline</span>
        }
        <p class="rotulo">Conta autenticada com Google. Depois do primeiro login, o app abre mesmo sem internet.</p>
      </section>

      <button type="button" class="btn btn-perigo" (click)="sair()"><app-icone nome="sair" /> Sair da conta</button>
    </div>
  `,
  styles: `
    .usuario {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--offline-bg);
      object-fit: cover;
    }
    .chip {
      align-self: flex-start;
    }
  `,
})
export class Perfil {
  protected readonly auth = inject(AuthService);
  protected readonly conectividade = inject(ConectividadeService);
  private readonly router = inject(Router);

  protected sair(): void {
    this.auth.sair();
    this.router.navigate(['/login']);
  }
}
