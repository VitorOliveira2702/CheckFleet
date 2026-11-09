import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

/**
 * Token no formato JWT. Só o payload importa aqui: a assinatura é conferida
 * pela API. O JSON vai em UTF-8, como num token de verdade (por causa do "ã").
 */
function tokenFalso(payload: object): string {
  const utf8 = String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload)));
  const base64Url = btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `cabecalho.${base64Url}.assinatura`;
}

describe('AuthService (login com e-mail e senha)', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('entra com o token emitido pela API e guarda o usuário para abrir offline', async () => {
    const entrada = auth.entrar('maria@empresa.com', 'senha-forte');

    const requisicao = http.expectOne('http://localhost:8080/api/auth/login');
    expect(requisicao.request.body).toEqual({ email: 'maria@empresa.com', senha: 'senha-forte' });
    const token = tokenFalso({ iss: 'checkfleet-api', name: 'Maria', email: 'maria@empresa.com' });
    requisicao.flush({ token });
    await entrada;

    expect(auth.usuario()).toEqual({ nome: 'Maria', email: 'maria@empresa.com', foto: '', token, provedor: 'senha' });
    expect(JSON.parse(localStorage.getItem('checkfleet.usuario')!).token).toBe(token);
  });

  it('cria a conta e já entra', async () => {
    const cadastro = auth.cadastrar('João', 'joao@empresa.com', '12345678');

    const requisicao = http.expectOne('http://localhost:8080/api/auth/cadastro');
    expect(requisicao.request.body).toEqual({ nome: 'João', email: 'joao@empresa.com', senha: '12345678' });
    requisicao.flush(
      { token: tokenFalso({ iss: 'checkfleet-api', name: 'João', email: 'joao@empresa.com' }) },
      { status: 201, statusText: 'Created' },
    );
    await cadastro;

    expect(auth.usuario()?.nome).toBe('João');
  });

  it('mostra uma mensagem clara quando a senha está errada', async () => {
    const entrada = auth.entrar('maria@empresa.com', 'errada');

    http.expectOne('http://localhost:8080/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(entrada).rejects.toThrow('E-mail ou senha inválidos.');
    expect(auth.logado()).toBe(false);
  });

  it('avisa que o e-mail já existe ao criar uma conta repetida', async () => {
    const cadastro = auth.cadastrar('Maria', 'maria@empresa.com', '12345678');

    http.expectOne('http://localhost:8080/api/auth/cadastro').flush(null, { status: 409, statusText: 'Conflict' });

    await expect(cadastro).rejects.toThrow('Este e-mail já está cadastrado. Use a opção Entrar.');
  });

  it('identifica o login com Google pelo emissor do token', () => {
    // salvar() é privado; é o mesmo caminho que o callback do botão do Google usa.
    (auth as unknown as { salvar(token: string): void }).salvar(
      tokenFalso({ iss: 'https://accounts.google.com', name: 'Ana', email: 'ana@gmail.com', picture: 'foto.jpg' }),
    );

    expect(auth.usuario()).toMatchObject({ nome: 'Ana', foto: 'foto.jpg', provedor: 'google' });
  });

  it('desloga quando a API recusa um token vencido', async () => {
    (auth as unknown as { salvar(token: string): void }).salvar(tokenFalso({ iss: 'checkfleet-api', name: 'Maria', email: 'm@e.com' }));
    const chamada = firstValueFrom(TestBed.inject(HttpClient).get('http://localhost:8080/api/vistorias'));

    const requisicao = http.expectOne('http://localhost:8080/api/vistorias');
    expect(requisicao.request.headers.get('Authorization')).toMatch(/^Bearer /);
    requisicao.flush(null, { status: 401, statusText: 'Unauthorized' });

    await expect(chamada).rejects.toBeDefined();
    expect(auth.logado()).toBe(false);
  });
});
