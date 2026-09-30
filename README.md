# CheckFleet

Prova de conceito de Progressive Web App (PWA) *offline-first* para vistoria de frotas, desenvolvida como Trabalho de Conclusão de Curso em Ciência da Computação.

## Sobre o projeto

Inspetores preenchem checklists diários de manutenção de veículos (pneus, freios, avarias) em locais com conectividade instável — garagens subterrâneas, pátios rodoviários sem sinal. O CheckFleet valida, na prática, em que medida o uso de **Service Workers** e **IndexedDB** numa arquitetura PWA offline-first contribui para garantir a disponibilidade da aplicação e a integridade dos dados sob conectividade intermitente.

A aplicação salva vistorias localmente quando não há conexão e sincroniza com o servidor de forma assíncrona e idempotente assim que a conectividade é restabelecida, evitando duplicidade de registros mesmo diante de falhas parciais de rede ou de servidor.

## Stack técnica

- **Front-end:** Angular + TypeScript, PWA via `@angular/pwa` (Service Worker), IndexedDB para persistência local
- **Back-end:** Spring Boot (Java 21), API REST
- **Banco de dados:** PostgreSQL, conteinerizado em Docker
- **Controle de versão:** Git + GitHub

## Estrutura do repositório

```
checkfleet/
├── api/            # Backend Spring Boot
├── frontend/       # Frontend Angular
├── docker-compose.yml
├── CLAUDE.md       # Contexto do projeto para ferramentas de IA
└── README.md
```

## Pré-requisitos

- [Node.js](https://nodejs.org/) e [Angular CLI](https://angular.dev/tools/cli) (`npm install -g @angular/cli`)
- [Java 21 (JDK)](https://adoptium.net/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Como rodar o projeto

**1. Banco de dados**
```bash
docker compose up -d
```

**2. Backend** (dentro da pasta `api`)
```bash
./mvnw spring-boot:run
```
A API sobe em `http://localhost:8080`.

**3. Frontend** (dentro da pasta `frontend`)
```bash
ng serve
```
A aplicação abre em `http://localhost:4200`.

> Sempre que reabrir o Docker Desktop após reiniciar o computador, confirme com `docker ps` se o container `checkfleet-db` subiu automaticamente antes de rodar o backend.

## Status do projeto

🚧 Em desenvolvimento — implementação iniciada em setembro/2026.

- [x] Front-end Angular com suporte a PWA configurado
- [x] Back-end Spring Boot conectado ao PostgreSQL via Docker
- [x] Cadastro e listagem de vistorias (online)
- [ ] Persistência local com IndexedDB (modo offline)
- [ ] Fila de sincronização e detecção de conectividade
- [ ] Testes de carga e resiliência a falhas (100/500 registros, falha parcial de API)

## Contexto acadêmico

Trabalho de Conclusão de Curso — Ciência da Computação, Centro Universitário do Distrito Federal (UDF).
Orientador: Prof. Eliel Cruz.
