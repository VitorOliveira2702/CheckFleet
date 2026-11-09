import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Coloca o token em toda chamada à API ("Authorization: Bearer ...").
 *
 * O token do Google vale cerca de 1 hora; o do login com senha, 12 horas.
 * Quando a API responde 401 a uma chamada que levava token (token vencido ou
 * inválido), o usuário é mandado de volta para o login. Um 401 sem token é
 * só uma senha errada na tela de login, e quem trata é a própria tela.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.usuario()?.token;

  const requisicao = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(requisicao).pipe(
    catchError((erro: unknown) => {
      if (token && erro instanceof HttpErrorResponse && erro.status === 401) {
        auth.sair();
        router.navigate(['/login'], { queryParams: { expirou: 1 } });
      }
      return throwError(() => erro);
    }),
  );
};
