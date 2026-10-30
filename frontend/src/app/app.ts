import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './auth/auth.service';
import { ConectividadeService } from './shared/conectividade.service';
import { Icone } from './shared/icone';
import { SincronizacaoService } from './vistoria/sincronizacao.service';

/**
 * Casca do app: barra superior com a marca, banner de conectividade e
 * navegação inferior. As telas em si entram no <router-outlet>.
 */
@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly conectividade = inject(ConectividadeService);
  // Injetado aqui para a fila de sincronização começar a rodar assim que o app abre.
  protected readonly sync = inject(SincronizacaoService);

  protected readonly abas = [
    { rota: '/painel', rotulo: 'Painel', icone: 'painel' },
    { rota: '/vistorias/nova', rotulo: 'Vistoria', icone: 'vistoria' },
    { rota: '/laudos', rotulo: 'Laudos', icone: 'laudo' },
    { rota: '/perfil', rotulo: 'Perfil', icone: 'usuario' },
  ];
}
