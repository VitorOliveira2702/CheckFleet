import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';
import { Login } from './auth/login/login';
import { Painel } from './vistoria/painel/painel';
import { NovaVistoria } from './vistoria/nova-vistoria/nova-vistoria';
import { Laudos } from './vistoria/laudos/laudos';
import { Perfil } from './perfil/perfil';

export const routes: Routes = [
  { path: 'login', component: Login },
  // Todas as telas abaixo exigem login (authGuard).
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'painel' },
      { path: 'painel', component: Painel },
      { path: 'vistorias/nova', component: NovaVistoria },
      { path: 'laudos', component: Laudos },
      { path: 'perfil', component: Perfil },
    ],
  },
  { path: '**', redirectTo: 'painel' },
];
