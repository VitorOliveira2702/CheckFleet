# Roteiro dos testes da monografia (T01 a T08 e comparativo)

Como executar o plano de testes do Capítulo 3 usando as ferramentas do console
(`checkfleet`) e anotar os números para o capítulo de Resultados.

## 1. Preparar o ambiente

Os testes rodam no **build de produção**, porque só nele o Service Worker funciona.

1. Abrir o Docker Desktop e subir o banco (na raiz do projeto):
   ```bash
   docker compose up -d
   ```
2. Subir a API **com o perfil de teste** (em `api/api`). Sem o perfil, os
   comandos `falharApos`, `servidor` e a limpeza do servidor não existem.
   - Git Bash:
     ```bash
     ./mvnw spring-boot:run -Dspring-boot.run.profiles=teste
     ```
   - PowerShell:
     ```powershell
     .\mvnw spring-boot:run "-Dspring-boot.run.profiles=teste"
     ```
3. Subir o app (em `frontend`):
   ```bash
   npm run pwa
   ```
4. Abrir http://localhost:4200, fazer login e abrir o console (F12 → Console).
5. Conferir que as ferramentas carregaram:
   ```js
   checkfleet.ajuda()
   ```

Se o app abrir sem o `checkfleet`, o Service Worker ainda está servindo a versão
antiga: recarregue a página mais uma vez.

**Atenção ao login:** o token do Google vale cerca de 1 hora. Se a sincronização
passar a responder 401 e o app voltar para a tela de login, entre de novo; as
vistorias pendentes continuam no aparelho.

## 2. Comandos

| Comando | O que faz |
|---|---|
| `await checkfleet.gerar(100)` | Cria 100 vistorias de teste (placa `TST0001`, `TST0002`…) pelo mesmo caminho da tela |
| `await checkfleet.gerar(20, { fotos: 3 })` | Idem, com 3 fotos sintéticas de 150 KB cada |
| `await checkfleet.sincronizar()` | Envia a fila, espera terminar e devolve a medição |
| `checkfleet.medicoes()` | Tabela com o tempo de cada sincronização (total e por lote) |
| `await checkfleet.conferir()` | Compara o servidor com o que foi gerado: íntegras, faltando, divergentes, duplicadas |
| `await checkfleet.servidor()` | Contagem das vistorias de teste direto no banco |
| `await checkfleet.falharApos(25)` | A API grava 25 vistorias e responde erro 500 na seguinte (uma vez só) |
| `await checkfleet.reenviar(10)` | Devolve 10 vistorias já confirmadas à fila, para reenviar os mesmos UUIDs |
| `checkfleet.modo('tradicional')` | Desliga a fila offline-first (grupo de controle). `'offline-first'` volta ao normal |
| `await checkfleet.armazenamento()` | Espaço usado no aparelho e se o armazenamento é persistente |
| `await checkfleet.limpar()` | Apaga as vistorias de teste do aparelho e do servidor |

As fotos sintéticas não são imagens de verdade, só têm o tamanho de uma foto
comprimida. Por isso o laudo em PDF de uma vistoria de teste com fotos não abre.

Para ficar offline: F12 → Network → trocar "No throttling" por **Offline**.

## 3. Os testes

Faça **3 repetições** de cada teste e rode `await checkfleet.limpar()` antes de cada uma.

### T01 e T02: disponibilidade da interface
1. Com conexão, abrir o app e navegar pelas telas. Print de Application →
   Service Workers (`ngsw-worker.js` ativo) e de Cache Storage.
2. Network → Offline e **recarregar a página**. O app deve abrir.
3. Anotar: abriu? (sim/não). Print da tela com a faixa "Modo offline".

### T03 e T04: 100 vistorias offline
1. Network → Offline.
2. `await checkfleet.gerar(100)` → anotar `salvas`, `perdidas` e `duracaoMs`.
3. `await checkfleet.armazenamento()` → anotar `usadoMb`.
4. Abrir Painel e Laudos: as vistorias `TST…` aparecem como "pendente" (T04).
5. Repetir com fotos, por exemplo `gerar(100, { fotos: 3 })`, e anotar o espaço.

Esperado: 100 salvas, 0 perdidas, 100 pendentes na faixa do topo.

### T05 e T06: sincronizar 500 pendentes
1. Network → Offline.
2. `await checkfleet.gerar(500)`.
3. Voltar para "No throttling". A sincronização começa sozinha (faixa "Sincronizando…").
4. Quando a faixa sumir: `checkfleet.medicoes()` → anotar `duracaoMs`, número de
   lotes e `confirmadas`.
5. `await checkfleet.conferir()` → esperado: `noServidor: 500`, `integras: 500`,
   `faltando: 0`, `divergentes: 0`, `duplicadas: 0`, `pendentesNoAparelho: 0`.

### T07: queda da API no meio de um lote
1. Com conexão: `await checkfleet.falharApos(25)`.
2. Network → Offline e `await checkfleet.gerar(100)`.
3. Voltar a conexão. A sincronização envia 2 lotes e falha no terceiro.
4. `checkfleet.medicoes()` → a última linha deve ter `falhou: true` e 20 confirmadas.
5. `await checkfleet.servidor()` → 25 no banco (5 foram gravadas antes da falha,
   mas o aparelho não recebeu a confirmação).
6. A faixa mostra 80 vistorias aguardando envio. Print.
7. `await checkfleet.sincronizar()` (ou o botão "Enviar agora").
8. `await checkfleet.conferir()` → esperado: 100 no servidor, 100 íntegras, 0 duplicadas.

O passo 8 é a evidência da idempotência: 5 vistorias foram enviadas duas vezes e
o servidor continuou com 100.

### T08: reenvio do mesmo identificador
1. Depois de um T05 completo: `await checkfleet.servidor()` → anotar a contagem.
2. `await checkfleet.reenviar(50)` e `await checkfleet.sincronizar()`.
3. `await checkfleet.servidor()` → a contagem deve ser a mesma.

### Comparativo: offline-first × tradicional
Mesmo cenário nos dois modos: registrar 100 vistorias **sem conexão**.

1. `checkfleet.modo('tradicional')` → aparece uma faixa de aviso no topo.
2. Network → Offline e `await checkfleet.gerar(100)` → anotar `perdidas`.
3. Voltar a conexão e `await checkfleet.conferir()` → anotar `noServidor` e `faltando`.
4. `await checkfleet.limpar()` e `checkfleet.modo('offline-first')`.
5. Repetir os passos 2 e 3 (esperando a sincronização terminar antes de conferir).

Variação: em vez de desligar a rede, parar a API (Ctrl+C no terminal dela) para
simular servidor fora do ar com a rede funcionando.

**Não esqueça de voltar para `'offline-first'` no fim**: o modo fica gravado no navegador.

## 4. Conferência direta no banco

Para ter uma segunda evidência, independente do app:

```bash
docker exec checkfleet-db psql -U checkfleet -d checkfleet -c "SELECT count(*) FROM vistorias WHERE placa LIKE 'TST%';"
```

```bash
docker exec checkfleet-db psql -U checkfleet -d checkfleet -c "SELECT placa, count(*) FROM vistorias WHERE placa LIKE 'TST%' GROUP BY placa HAVING count(*) > 1;"
```

```bash
docker exec checkfleet-db psql -U checkfleet -d checkfleet -c "SELECT count(*) FROM vistoria_itens i JOIN vistorias v ON v.id = i.vistoria_id WHERE v.placa LIKE 'TST%';"
```

- A primeira deve dar o número de vistorias geradas.
- A segunda deve voltar vazia (nenhuma vistoria gravada duas vezes).
- A terceira deve dar 5 vezes o número de vistorias (5 itens de checklist cada).

## 5. O que anotar (planilha)

| Teste | Repetição | Geradas | Salvas | Perdidas | Tempo (ms) | Lotes | No servidor | Íntegras | Duplicadas | Espaço (MB) | Observações |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T03 | 1 | 100 | | | | – | – | – | – | | |
| T05 | 1 | 500 | | | | | | | | | |
| T07 | 1 | 100 | | | | | | | | | |
| Comparativo (tradicional) | 1 | 100 | | | – | – | | | | – | |
| Comparativo (offline-first) | 1 | 100 | | | | | | | | – | |

Anote também o ambiente: modelo do computador, navegador e versão, e a data.
