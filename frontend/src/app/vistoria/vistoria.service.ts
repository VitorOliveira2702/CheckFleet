import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Vistoria } from './vistoria.model';

/** Chamadas HTTP à API. Quem decide quando chamar é o SincronizacaoService. */
@Injectable({ providedIn: 'root' })
export class VistoriaService {
  private readonly http = inject(HttpClient);

  // Fixo por enquanto (PoC rodando local); numa versão real viraria configuração de ambiente.
  private readonly baseUrl = 'http://localhost:8080/api/vistorias';

  /** Envia várias vistorias de uma vez (RF06); o servidor ignora as que já tem (RF09). */
  enviarLote(vistorias: Vistoria[]): Observable<Vistoria[]> {
    return this.http.post<Vistoria[]>(`${this.baseUrl}/lote`, vistorias);
  }

  listar(): Observable<Vistoria[]> {
    return this.http.get<Vistoria[]>(this.baseUrl);
  }
}
