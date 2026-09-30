# CheckFleet

## Sobre o projeto
Prova de conceito de TCC em Ciência da Computação (UDF), sob orientação do Prof. Eliel Cruz.

Pergunta de pesquisa: Em que medida o uso de Service Workers e IndexedDB em uma
arquitetura PWA offline-first contribui para garantir a disponibilidade da aplicação
e a integridade dos dados sob conectividade intermitente?

O CheckFleet é um aplicativo de vistoria de frotas usado como estudo de caso para
validar essa arquitetura: inspetores preenchem checklists de manutenção (pneus,
freios, avarias) de veículos em locais com conectividade instável (garagens
subterrâneas, pátios rodoviários). O app precisa funcionar offline, guardar as
vistorias localmente e sincronizar com o servidor sem duplicar dados quando a
conexão voltar.

## Estrutura do projeto
- `frontEnd/` — Angular + PWA (Service Worker via @angular/pwa) + IndexedDB
- `backend/` — API REST em Spring Boot + PostgreSQL (ainda não criada)
- Infraestrutura: PostgreSQL conteinerizado em Docker

## Stack técnica
- Front-end: Angular, TypeScript, CSS puro (sem SCSS), sem SSR
- Persistência local: IndexedDB
- Back-end: Spring Boot, PostgreSQL, Docker
- Controle de versão: Git + GitHub

## Requisitos-chave (ver monografia para lista completa)
- RF01: cadastro de vistoria (placa do veículo + checklist de itens)
- RF04/RF05: armazenar vistorias offline e manter fila de sincronização
- RF06/RF09: sincronizar em lote e assinar cada vistoria com identificador único (UUID)
  para controle de idempotência (evitar duplicidade no servidor)
- RNF05: sincronização idempotente

## Como trabalhar comigo neste projeto
- Sou iniciante em Angular e estou aprendendo na prática. Antes de gerar código,
  explique brevemente o raciocínio e o que cada parte faz.
- Prefira soluções simples e diretas em vez de padrões avançados/genéricos — o
  objetivo é aprender e entregar uma prova de conceito, não um produto de mercado.
- Sempre que possível, relacione o código com o requisito ou critério de teste da
  monografia que ele está atendendo.