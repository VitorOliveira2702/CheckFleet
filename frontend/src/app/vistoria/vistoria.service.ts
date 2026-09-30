import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Vistoria } from './vistoria.model';

@Injectable({ providedIn: 'root' })
export class VistoriaService {
  private readonly http = inject(HttpClient);

  // Fixo por enquanto (PoC rodando local); numa versão real viraria configuração de ambiente.
  private readonly baseUrl = 'http://localhost:8080/api/vistorias';

  cadastrar(vistoria: Vistoria): Observable<Vistoria> {
    return this.http.post<Vistoria>(this.baseUrl, vistoria);
  }

  listar(): Observable<Vistoria[]> {
    return this.http.get<Vistoria[]>(this.baseUrl);
  }
}
