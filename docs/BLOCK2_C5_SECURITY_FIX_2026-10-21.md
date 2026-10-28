# C5 SECURITY — correção pontual de Tarefas e OS

Entrada: `audit/block2-sanitized`, HEAD **5ec8ed129bc23464eddb3dcdae7a147508de57da**, árvore limpa. Código corrigido e executado: **a9aa6ed6316b41bcfd7cedc1d52c3d4420187aa6**. Evidências: [resultados comparativos e matriz de 84 cenários](evidence/BLOCK2_C5_SECURITY_RESULTS_2026-10-21.json).

**Resultado:** os bloqueadores demonstrados C5-01 (P0 nesta autorização; chamado P1 na auditoria original) e C5-02 (P1) passaram nos dois probes originais, sem alterar suas asserções. Isto encerra a correção desses casos no ambiente local; **não aprova rollout comercial, C5 integral ou G1–G6**. C6 não iniciado.

## Causas e correções

1. **C5-01, escrita e efeitos colaterais:** o filtro organizationId validava apenas a tarefa/OS principal. FKs globais aceitavam Lead, projeto e responsável de outra organização. A resposta incluía seus dados; notificações/atividades eram posteriores e não atômicas. Agora os quatro handlers reutilizam `checkPermission` e validam cada vínculo efetivo no mesmo tenant, incluindo referências omitidas no PUT, criador e ator. Responsável e ator precisam estar ativos. Referência inválida produz **400 genérico**, sem informar existência, nome ou ID de outro tenant. UPDATE/DELETE finais também incluem organizationId.
2. **C5-01, leitura:** filtrar a raiz não restringia automaticamente os joins. Agora listagem, contagem e detalhe aplicam o mesmo predicado de relações antes da consulta; registros com referências históricas estrangeiras ficam ausentes da lista e retornam **404 no detalhe**, sem reescrever dados. `RepeatableRead` mantém raiz, relações e contagens no mesmo snapshot. Anexos, comentários, autores, uploads e respostas carregados pelo detalhe de Tarefas também recebem escopo de organização e entidade; contagens seguem esse escopo.
3. **C5-02, permissões relacionadas:** tasks.view autorizava indiscriminadamente o include de Lead. Agora `leads.view` é consultado pelo mecanismo existente no backend. Tarefas vinculadas a Leads não acessíveis ficam fora da resposta inteira, incluindo título, IDs e contagens; não apenas `lead.name`. O mesmo princípio usa `projects.view` existente para projetos relacionados em Tarefas/OS. PUT e DELETE verificam a acessibilidade do registro atual: limpar leadId pelo PUT não contorna a proteção. Tarefas sem esses vínculos continuam disponíveis com suas permissões normais.
4. **Atomicidade e concorrência:** transações abrangem validação, escrita, atividade e notificações. `FOR UPDATE` serializa alterações da raiz; `FOR SHARE` mantém referências no tenant durante a transação, inclusive contra reassociação e remoção lógica concorrentes. SQL parametrizado; nomes de tabelas são constantes internas. Notificações usam destinatário ativo do mesmo tenant, sua permissão existente de Tarefas/OS e permissões dos recursos relacionados. Falha de persistência desfaz também notificações já criadas. Conflitos Prisma conhecidos retornam 409 genérico; falhas inesperadas continuam 500 genérico, sem resposta parcial.

Não há outro autenticador, catálogo, motor comercial ou modelo de dados. O helper novo é exclusivamente de integridade/consulta dos quatro handlers. Os DELETEs nesses mesmos arquivos também foram incluídos para evitar efeitos parciais e atividade com referência estrangeira; nenhuma outra família de APIs foi alterada.

## Arquivos e fronteiras

| Arquivo | Alteração |
|---|---|
| `src/app/api/tasks/route.ts` | Listagem/contagem autorizadas; criação e efeitos atômicos |
| `src/app/api/tasks/[id]/route.ts` | Detalhe, filhos carregados, atualização e exclusão com escopo e transação |
| `src/app/api/os/route.ts` | Listagem e criação protegidas; código sequencial consultado na mesma transação |
| `src/app/api/os/[id]/route.ts` | Detalhe/atualização/exclusão com escopo; tipo Prisma substitui any existente |
| `src/lib/task-os-relations.ts` | Predicados, validação de referências, locks e notificação autorizada |
| `tests/c5-task-os-security-postgres.test.mjs` | Nove testes funcionais com handlers reais e PostgreSQL |
| `tests/c5-task-os-regression-http.mjs` | HTTP/NextAuth real: CRUD legítimo e tentativa de desvincular Lead sem permissão |
| `tests/authorization-boundaries.test.ts` | Exceção precisa para os dois handlers de Tarefas expressamente autorizados; demais arquivos e subrotas continuam congelados |

Diff das fronteiras protegidas vazio contra 5ec8ed1: autenticação/permissões, motor comercial, entitlements, planos, providers/Atendimento/Leads/Kanban/Projetos, schema/migrations, dependências e CI. Testes de fronteira existentes passaram. Os dois probes originais estão byte a byte preservados. Nenhuma regra de lint foi relaxada; nenhum .env, credencial, dado de produção ou artefato temporário entrou neste commit.

## HTTP antes/depois

| Probe/caso | Antes | Depois no build final |
|---|---|---|
| POST/PUT de Tarefas/OS com referências estrangeiras, owner/admin/user | 30 respostas 201/200, vínculos persistidos e dados relacionados | **30 respostas 400**, zero vínculos estrangeiros gravados; testes adicionais conferem banco, atividade e notificações, inclusive PUT com alteração válida misturada à referência inválida |
| GET lista/detalhe com relações históricas estrangeiras | 12 respostas 200 com marcador estrangeiro | Seis listas **200 sem o registro inválido**; seis detalhes **404**; zero marcadores estrangeiros |
| Notificações para o usuário do outro tenant | 9 | **0** |
| Usuário sem leads.view, sete contratos × duas marcas × dois tenants | API Leads 403, mas Tasks 200 com nome do Lead em 28 cenários | API Leads **403**, Tasks **200 sem tarefa/Lead restrito**; **0/84** cenários com vazamento |
| CRUD legítimo de Tarefas e OS | Não era o objetivo do probe negativo | 12 ciclos: **201/200/200/200**, duas organizações × três papéis × dois recursos; datas, conclusão, vínculos corretos e limpeza null preservados |
| Desvincular Lead sem permissão para revelar tarefa | Cobertura nova | GET **404**, PUT **404**, leadId inalterado nos dois tenants |
| Dashboard C0 | Evidência histórica protegida | Ativo **200**; usuário/organização removidos **307 sem dados**; restrito **403 em Leads/200 no Dashboard sem Leads** |

O cross-tenant foi reproduzido antes da correção nesta execução, com **42 falhas e nove notificações**. O comparativo de 28 exposições vem da execução C5 preservada: `git diff 5f0f8a9 5ec8ed1 -- src` vazio comprova mesma fonte funcional de entrada. Ambos os probes foram reexecutados no build final e retornaram **exit 0**. Seus campos internos `referenceHead` continuam históricos; o manifesto novo identifica o SHA efetivamente executado.

## Testes executados

Ambiente exclusivamente descartável: Node **v24.19.0**, Next **16.3.8**, NextAuth real, HTTP `127.0.0.1:3100`, PostgreSQL `127.0.0.1:5432/mds_crm_dev`. Variáveis carregadas do arquivo local ignorado, sem imprimir valores. Servidor iniciado com `npx next start --hostname 127.0.0.1 --port 3100`, nunca `npm start`, cujo prestart executaria migrations. Segredo administrativo de teste gerado apenas em memória no processo local para a regressão White-Label.

| Comando/verificação | Resultado |
|---|---|
| `node tests/c5-cross-tenant-http.mjs` | **42/42 PASS**, notificações estrangeiras 0, exit 0 |
| `node tests/c5-direct-access-http.mjs` | **84/84 PASS**, 924 GETs de páginas, 840 leituras API, oito controles anônimos, três configurações inválidas; exposição Lead 0; query mode=enforce não promove modo real |
| `node tests/c5-task-os-regression-http.mjs` | **14/14 casos PASS**, 12 CRUDs completos e dois controles de permissão; exit 0 |
| `BLOCK2_TEST_DATABASE_URL="$DATABASE_URL" node --import tsx --test --test-reporter=tap tests/*.test.mjs` | **119 PASS**, zero fail/skip/TODO, incluindo nove novos testes PostgreSQL e regressões de segurança/Widget/Instagram |
| `npx tsx --test tests/*.test.ts` | **383 PASS**, zero fail/skip/TODO, incluindo fronteiras e regressões C0–C4 |
| `node tests/dashboard-c0-http.mjs` | PASS: identidade, permissões, indicadores e tenant preservados |
| `node tests/branding-white-label-http.mjs` | **84 cenários PASS**, 29 mudanças comerciais auditadas, quatro atualizações persistidas/quatro assets e seis negativas de cliente |
| `node .cache/bloco02-smoke.cjs` | **22 checks PASS**, incluindo login, autorização, isolamento e oito reservas simultâneas com um sucesso; harness local preexistente |
| `npm run build` | PASS; inclui `prisma generate`, sem migration. Aviso preexistente `images.domains` |
| `npx tsc --noEmit` | PASS após restaurar somente next-env.d.ts gerado ao conteúdo rastreado |
| `npx eslint` nos oito arquivos de código/teste alterados | **0 erros/0 avisos**, sem alterar configuração ou regras |
| `git diff --check` e diff de fronteiras protegidas | PASS |
| Conferência final de fixtures, transação READ ONLY | **0 organizações de fixtures, 0 admins de fixtures, 0 atividades órfãs dos marcadores sintéticos verificados** |

Os nove testes novos exercitam banco e handlers reais: referências estrangeiras em POST/PUT sem nenhuma mudança parcial; cada relação histórica inválida individualmente; Lead negado inclusive por desvinculação; CRUD e notificações legítimas; destinatário removido/sem permissão; anexos/comentários/respostas estrangeiros; rollback por falha injetada de notificação e de atividade; conflito PostgreSQL por tentativa de mudar tenant durante SHARE lock; dois PUTs paralelos e escrita/exclusão pelo outro tenant. Injeção de falha somente no adapter de teste; persistência e rollback no PostgreSQL real. Os dois probes de aceite usam a rede e autenticação reais.

Durante a conferência complementar, uma mudança nas restrições de rede do sandbox bloqueou sockets locais (P1001), antes de criar fixtures; não foi classificada como regressão do CRM. A repetição autorizada em loopback passou nos 22 checks e a consulta READ ONLY confirmou limpeza. O manifesto preserva essa ocorrência e os hashes dos artefatos finais. Não houve bloqueio de aprovação automática pendente.

## Matriz C5 atualizada no recorte

| URL/operação | Autenticação | Permissão operacional | Organização/relações | Contrato comercial |
|---|---|---|---|---|
| `/api/tasks` GET | Identidade ativa existente | tasks.view + leads.view/projects.view quando vinculados | Raiz, joins e contagens filtrados antes da resposta | Observado; bloqueio comercial pendente |
| `/api/tasks` POST | Identidade ativa existente | tasks.create + visualização dos recursos vinculados | Ator/responsável/referências válidos; transação e notificação autorizada | Observado; bloqueio comercial pendente |
| `/api/tasks/[id]` GET/PUT/DELETE | Identidade ativa existente | tasks.view/edit/delete e recursos relacionados | Escopo da raiz atual, filhos carregados; escrita/efeitos atômicos | Observado; bloqueio comercial pendente |
| `/api/os` GET/POST | Identidade ativa existente | os.view/create + projects.view quando vinculado; limites existentes preservados | Raiz/joins na leitura; referências/efeitos na escrita | Observado; bloqueio comercial pendente |
| `/api/os/[id]` GET/PUT/DELETE | Identidade ativa existente | os.view/edit/delete + projeto relacionado | Escopo atual e final; referências e transação | Observado; bloqueio comercial pendente |

## Limites e riscos residuais

- C5-03/C5-04 continuam bloqueando rollout: cobertura comercial parcial, recursos compartilhados sem contrato por contexto e compatibilidade de permissões/legados. `observe_only` e `APPROVED_ENFORCEMENTS = []` byte a byte preservados. Nenhum bloqueio comercial ativado.
- Não há constraint composta de tenant nova no banco. Proteção verificada nestes handlers; dados malformados antigos e escritas diretas/outras superfícies exigem avaliação própria. Os registros inválidos ficam ocultos nestas consultas; eventual reparação controlada de dados precisa de inventário e autorização separados.
- Subrotas de subtarefas e APIs genéricas de comentários/anexos não foram modificadas nem recebem certificação por analogia. Este recorte protege os dados carregados pelos quatro handlers; a política comercial/operacional dos demais recursos compartilhados continua na auditoria.
- Locks/transações têm custo e timeout sob carga; houve testes funcionais de concorrência, não ensaio de carga. A colisão preexistente de código sequencial OS pode produzir 409 e exigir nova tentativa; não foi criado outro alocador de códigos.
- Não houve provider remoto, produção, navegador completo ou CI Node 22; lint/dependências globais anteriores não foram saneados nem novamente auditados neste lote. Nenhuma mudança de dependências.
- Nenhuma revisão independente nova foi concluída; relatório e testes estão preparados para revisão. Sem push/merge/deploy/migration/Coolify ou alteração de dados de produção.

| Gate | Evidência desta rodada | Situação |
|---|---|---|
| G1 | Regressões de auth/sessão e C0 HTTP positivas | Sem aprovação integral |
| G2 | Bypass de Leads e quatro handlers corrigidos e testados | P1 demonstrado resolvido no recorte; revisão ampla/independente pendente |
| G3 | Probes cross-tenant e notificações zerados; regressões Widget incluídas | P0 demonstrado resolvido no recorte; homologação de providers/legado pendente |
| G4 | Regressões Instagram/PostgreSQL na suíte positiva | Sem novo aceite de Meta/operação real |
| G5 | Observe_only/manifesto vazio e matriz 84 cenários preservados | Rollout bloqueado por cobertura/compatibilidade; sem enforcement |
| G6 | Testes, HTTP, typecheck, build, lint do recorte e evidências locais | Revisão independente, CI remota e demais pendências continuam abertas; C6 não iniciado |

O commit documental desta entrega é consultável com `git log -1 --format=%H -- docs/BLOCK2_C5_SECURITY_FIX_2026-10-21.md`. O manifesto registra o commit funcional e hashes de **arquivos de evidência**, não impressões digitais de credenciais. Os artefatos completos permanecem em `/workspace/mds-crm-onboarding-evidence/c5-security/`.
