# C5-03/C5-04 — lote granular1: subtarefas

**Lote1 concluído nos cenários exercitados; prioridade1 ainda incompleta. Próximo lote interrompido por dependência de core fora do recorte autorizado. C5-03/C5-04 e piloto NÃO aprovados.**

Referência inicial confirmada: branch `audit/block2-sanitized`, HEAD `f0acc3e`, árvore limpa. Commit funcional/testes: **`7d4bcf78793dca646a83d603d560dba652e4ddf1`**. PR15 preservada, sem atualização remota. Horário/data de referência:21/10/2026, America/Sao_Paulo.

## Arquivos e justificativa do lote

Somente **duas das61 APIs autorizadas** foram modificadas:

| Arquivo | Operações | Alteração |
|---|---|---|
| `src/app/api/tasks/[id]/subtasks/route.ts` | GET/POST | Selecionar tipo/referências da tarefa-pai já limitada ao tenant e aplicar `taskCommercialDenial` existente antes de ler/criar subtarefas |
| `src/app/api/tasks/[id]/subtasks/[subtaskId]/route.ts` | PUT/DELETE | Mesma herança comercial, preservando checagem posterior de que a subtarefa pertence à tarefa validada |

A tarefa persistida, buscada por `id + organizationId` da sessão verificada, fornece `type`, `leadId` e `projectId`. Tarefa comum→Marketing; `follow_up`→Vendas; referências Lead/Projeto mantêm seus contratos/permissões próprios. O cliente não informa o módulo comercial. O guard existente valida usuário/organização/assinatura/papel/permissões conforme o seletor existente. Em observe_only a checagem comercial permanece sem bloqueio; autenticação/tenant/permissão operacional continuam obrigatórios. Nenhum novo motor ou regra comercial duplicada foi criado.

A criação de subtarefa continua exigindo **tasks.edit**, conforme contrato operacional existente; não se inventou tasks.create para substituir essa regra. Leituras exigem tasks.view, edição tasks.edit e exclusão tasks.delete. Não há operação bulk própria nessas duas rotas. Os handlers, schemas, serialização e corpos CRUD anteriores permanecem byte a byte iguais exceto import, seleção de três campos e duas chamadas aditivas por arquivo.

Testes alterados: `tests/c5-remaining-surfaces-http.mjs`, com CRUD real e matriz comercial; `tests/authorization-boundaries.test.ts`, com comparação exata dos dois deltas autorizados. O freeze histórico de todas as rotas de Tasks, definido antes desta autorização, acusou essas duas mudanças: não foi falha funcional ou motivo para remover a proteção. A comparação foi substituída **somente nesses dois arquivos** por pin completo do delta exato contra f0acc3e; todas as demais superfícies e testes funcionais permanecem protegidos. A suíte passou com essa verificação adicional.

## Evidência HTTP/PostgreSQL

Somente fixtures em `127.0.0.1:5432/mds_crm_dev`, servidor local e cópia isolada. Nenhuma organização MDS/Ótica real foi consultada. A política da candidata não mudou: `observe_only`, `APPROVED_ENFORCEMENTS=[]`. O runner existente selecionou **apenas o UUID sintético do piloto na cópia descartável**, conferiu que a política real permaneceu igual e removeu a cópia.

| Cenário | Antes no lote anterior | Depois |
|---|---|---|
| GET de subtarefas de tarefa comum sem Marketing, owner/admin/user | 200 com marcador de Marketing,3 FAIL | **403**, sem marcador,3 PASS |
| POST/PUT/DELETE de subtarefa de tarefa comum sem Marketing | Não comprovado por HTTP de escrita | **403** nos9 casos; snapshot PostgreSQL inalterado |
| CRUD de subtarefa de follow-up de Vendas contratado, três papéis | Não exercitado pelo probe indireto anterior | **201/200/200/200**, persistência/edição/exclusão confirmadas em PostgreSQL,12 PASS |
| Pai estrangeiro em GET/POST/PUT/DELETE, três papéis | Fora da matriz original dos nove | **404**,12 PASS; zero subtarefas estrangeiras criadas e subtarefa própria preservada |
| Sete contratos × duas marcas × três papéis × tarefa comum/follow-up × quatro operações | Guards gerais tinham cobertura, endpoint não | **336/336 PASS**; writes negados sem alteração; writes legítimos conferidos no banco |
| Comentários/anexos de tarefa comum sem Marketing, três papéis | Seis FAIL | **Seis FAIL preservados:** HTTP200 com marcador; nenhuma correção alegada |

Total do probe indireto ampliado: **378 verificações,372 PASS e6 FAIL**. Os372 PASS pertencem ao lote de subtarefas; os seis FAIL são os dois caminhos de comentários/anexos, três papéis cada. O runner agregado continua **exit1**, sem converter falha comercial em aprovação. Das **nove expectativas originais**, três passaram e seis continuam reprovadas. O probe direto original continua **21/21 PASS somente na cópia isolada**.

As leituras/escritas de aceitação são requests HTTP reais aos handlers Next, login NextAuth real e Prisma/PostgreSQL reais. Não são testes de código-fonte. O pin do delta é uma proteção complementar de escopo, não a prova de segurança.

## Regressões executadas

| Comando / prova | Resultado |
|---|---|
| `BLOCK2_TEST_DATABASE_URL="$DATABASE_URL" node --import tsx --test --test-concurrency=1 tests/*.test.mjs` | **147/147 PASS**, zero skip/TODO; inclui Widget, OAuth, autorização, isolamento e P2 de comentários |
| `npx tsx --test tests/*.test.ts` após adicionar pin exato dos dois arquivos autorizados | **386/386 PASS** |
| `node scripts/block2-c5-isolated-http.mjs` | Direto21/21 PASS; indireto372/378; seis falhas conhecidas, exit1 |
| `node scripts/block2-c6-ci.mjs http` | **6/6 probes C0–C5 PASS**, incluindo42 cenários de navegação/indicadores,84 de White-Label e84 de acesso direto |
| `node tests/comments-delete-http.mjs`; `node tests/comments-tenant-http.mjs` em servidor local | **62/62 +53/53 PASS**; GET/POST/DELETE e correção anterior preservados |
| `npm run build`; `npx tsc --noEmit` | PASS; next-env gerado restaurado |
| ESLint dos quatro arquivos código/teste alterados, comparado a f0acc3e por stdin | **Zero erros/avisos novos ou preexistentes** nesses arquivos; regras intactas |
| `git diff --check`; histórico saneado; varredura em memória de valores conhecidos/padrões fortes | PASS; sem exposição de valores/hashes de credenciais; limites heurísticos mantidos |
| Limpeza do banco descartável | Zero organizações/admins/orfãos sintéticos dos probes |

O build da candidata não incluiu alterações funcionais posteriores: depois dele foram ampliados apenas testes/documentação. Não foi executado `npm start`, migration, provider real, npm audit ou workflow remoto. Os quatro workflows remotos verdes anteriores não foram atribuídos a este SHA.

[Evidência versionada](evidence/BLOCK2_C5_GRANULAR_LOT1_RESULTS_2026-10-21.json) vincula commit e fingerprints de código, resultados originais, matriz ampliada e diagnóstico abaixo. Logs integrais privados fora do Git: `/workspace/mds-crm-onboarding-evidence/c5-granular/`. [Matriz oficial atualizada](BLOCK2_C5_03_04_COVERAGE_2026-10-21.md):116 APIs,177 operações,28 páginas; **59 arquivos API e quatro layouts ainda pendentes** do plano inicial. Quatro operações de subtarefas passaram à classe de guard herdado preparado em observe_only.

## Por que o próximo lote foi interrompido

A autorização atual limita produção aos **61 arquivos de APIs e quatro layouts** e determina: **“Se um lote modificar uma superfície protegida, apresentar regressão ou exigir uma mudança arquitetural ampla, interromper esse lote e informar a alternativa pontual.”** O próximo lote não foi iniciado nem alterou comentários/anexos ou o core.

A dependência foi comprovada pelo **authorizer existente com PostgreSQL real**, não inferida apenas pela matriz. Uma organização fictícia ativa, assinatura trial válida, todos os módulos e permissões verdadeiras, papéis owner/admin/user, recebeu `insufficient_permission` em todos os12 casos abaixo. Marketing/projects.view, usado como controle positivo, foi autorizado nos três papéis:

| Par hoje ausente no core | Necessidade comprovada no contrato/código existente |
|---|---|
| Vendas + `projects` | Comentários/anexos de entidade `goal` já exigem projects; Metas pertencem a Vendas; não trocar por outra permissão artificial |
| Vendas + `goals` | CRUD de Metas mantém sua permissão operacional goals |
| Vendas + `agenda` | Agenda de Vendas mantém agenda; vínculo com Projeto acrescenta Marketing |
| Atendimento + `integrations` | Administração de canais/providers mantém integrations, independente de outros módulos |

Este diagnóstico termina **exit1 de compatibilidade**, não conta como teste de aceitação aprovado. Os pares estão na constante protegida `modulePermissions` de `src/lib/authorization/authorize.ts`, fora do limite de61+4 arquivos. Substituir permissões por leads/atendimento para obter PASS negaria operação legítima ou concederia autoridade diferente; copiar outro motor nos handlers violaria o requisito de reutilização.

Além disso, GET/POST de comentários revalidam usuário/organização/permissão sob locks **dentro da transação**, com teste de pool unitário. Os adapters atuais de `server.ts`/`guards.ts` fazem leituras pelo Prisma global. Simplesmente chamá-los dentro dessa transação pode requerer outra conexão; mover a verificação para fora não oferece a mesma revalidação do recurso/binding sob lock. É uma limitação de adaptação identificada no código, **não uma nova falha de deadlock reproduzida nesta rodada**. Não foi introduzida nem contornada. O próximo lote deve usar o authorizer existente com o mesmo cliente transacional e entidade canônica, preservando a prova P2.

## Alternativa pontual para autorização específica

Exceção proposta aos61+4 arquivos, limitada a **quatro helpers existentes**, sem wrapper geral, novo motor, schema ou provider:

| Arquivo fora do recorte atual | Mudança proposta e limites |
|---|---|
| `src/lib/authorization/authorize.ts` | Acrescentar somente os quatro pares explícitos acima; manter corpos de validação de identidade/assinatura/permissões e decisões intactos; negativos de combinações indevidas continuam obrigatórios |
| `src/lib/authorization/server.ts` | Adaptar a avaliação existente a cliente transacional/contexto verificado exclusivamente no servidor; preservar resolver, regras adicionais e seletor; nenhuma flag/header/query de cliente pode fornecer contexto ou enforcement |
| `src/lib/authorization/guards.ts` | Boundary aditivo para usar o mesmo authorizer com o cliente da transação e identidade já autenticada; manter comportamento dos guards existentes e observação global; não liberar se avaliação falhar |
| `src/lib/authorization/operation-data.ts` | Resolver canonicamente entidade/tipo/dependências no tenant e cliente recebidos, retornando requisitos para o motor existente; anexos de comentário herdam entidade persistida; sem novo catálogo/permissão/motor |

Após essa exceção autorizada: lote2 somente `comments/route.ts` e `comments/[id]/route.ts`, com CRUD, respostas, pais/entidades, locks/P2/pool1 e zero writes negados; lote3 somente as duas APIs de anexos, com resolução de comentário/entidade antes de efeitos de filesystem, uploads/downloads e exclusão; repetir os nove originais sem afrouxar asserções. Somente depois prosseguir aos demais grupos do plano, conforme a ordem solicitada. Cada lote exige revisão de diff, positivos/negativos três papéis, sete contratos, duas organizações, assinatura/permissão negada, tenant, regressão e commit local separado. Se surgir nova dependência protegida não incluída, parar esse lote novamente.

**A proposta acima não foi implementada.** Não houve nova rejeição automática de ferramentas nesta rodada; o bloqueio atual decorre do limite de arquivos e critério de parada explicitados pelo usuário. Não se usa a rejeição histórica do wrapper como impedimento a um lote já autorizado.

## Recomendação G2/G3/G5 e rollout

- **G2:** evidência positiva nas quatro operações de subtarefas e regressões existentes; **não aprovar** cobertura comercial enquanto comentários/anexos e demais métodos estiverem pendentes.
- **G3:** tenant estrangeiro negado nos12 requests deste lote e regressões anteriores positivas; **não aprovar globalmente** todas as relações/providers/177 operações ou concorrência não exercitada.
- **G5:** **bloqueado** pelos seis acessos indiretos e pares de compatibilidade comprovadamente ausentes. Os21 diretos na simulação e372 checks deste lote não bastam para liberar o piloto.

G1/G4 não foram alterados e não recebem aprovação automática por regressão; G6 depende também dos lotes restantes, revisão independente e CI do SHA futuro autorizado. Nenhuma ativação nominal está pronta para execução. A proposta anterior de rollout da Ótica São Paulo continua condicionada a cobertura completa, compatibilidade, aceite e autorização específica; manifesto permanece vazio. Nenhum dado real foi consultado ou migrado. Histórico e imagem/SHA de produção continuam inalterados.

Rollback local do lote é a reversão revisada apenas do commit7d4bcf7, preservando C0/P2/tenant/Widget/OAuth. Isso restaura a lacuna comercial de subtarefas sob futuro enforcement, portanto não é um rollback aceitável para liberar o piloto. Não há migration, reversão de dados, remoção de nonces/receipts/inbox ou credenciais. Rollback/ativação em ambiente real não foram autorizados nem executados.
