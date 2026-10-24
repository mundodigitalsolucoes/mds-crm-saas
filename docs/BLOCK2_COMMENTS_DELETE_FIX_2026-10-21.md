# Bloco 02 — DELETE de comentários: verificação e correção local

Branch `audit/block2-sanitized`; HEAD inicial confirmado `594606df027709152ab22ae48843b43da0db8499`; árvore inicialmente limpa. PR Draft #15 não alterada. Identificar o commit desta entrega com `git log -1 --format=%H -- src/app/api/comments/\[id\]/route.ts`.

## Causa-raiz e reprodução

O DELETE fazia lookup global por ID antes da autenticação. Depois de `checkPermission`, owner/admin podiam excluir comentários sem validar organização, autor local ou entidade. O cascade manual buscava respostas apenas pelo `parentId`, também sem escopo. Duas exclusões separadas não formavam uma transação; respostas aninhadas além do primeiro nível ficavam órfãs.

Reprodução em build Next real, HTTP/NextAuth reais e PostgreSQL descartável, somente fixtures sintéticas. O mesmo probe executou **62 casos antes e depois**, consultando o banco independentemente das respostas. Baseline: **31 falhas**, exit 1. Após correção: **62/62 PASS**, exit 0.

| Caso | Antes | Depois |
|---|---|---|
| Owner/admin A exclui raiz de B e sua resposta | `200`, duas linhas de B apagadas | `404`, ambas preservadas |
| Owner/admin A exclui resposta de B | `200`, resposta de B apagada | `404`, raiz e resposta preservadas |
| Usuário comum consulta exclusão estrangeira | `403`, distinguindo comentário existente do ausente | `404`, sem revelar existência estrangeira |
| Raiz local tem resposta de outro tenant | `200`, apaga também a resposta estrangeira | `409`, todas as linhas preservadas |
| Resposta com entidade/tipo/autor incompatível com o pai | Cascade remove as linhas no baseline | `409`, nenhuma alteração |
| Raiz com autor ou entidade estrangeiros | Exclusão aceita em cenários do baseline | `404`, sem alteração |
| Resposta local com pai estrangeiro | `200`, resposta removida | `409`, relação em quarentena, sem alteração de nenhum tenant |
| Três níveis legítimos | `200`, neto órfão permanece | `200`, toda a árvore local removida |
| Anônimo, ID existente/ausente | `401` / `404` | `401` / `401`, autenticação antes do lookup |
| Sem delete / usuário removido / organização removida | Controles existentes mantidos | `403` / `401` / `403`, nenhuma exclusão |

Positivos HTTP: owner, admin e usuário autor, quatro entidades (`task`, `lead`, `goal`, `kanban_card`), exclusão individual de resposta e de raiz com resposta; owner/admin continuam podendo excluir comentários de outro autor **da mesma organização** quando possuem a permissão existente. Usuário comum não pode excluir comentário de outro autor. Zero notificações e atividades geradas nas fixtures do probe.

[Evidências e impressões dos arquivos testados](evidence/BLOCK2_COMMENTS_DELETE_RESULTS_2026-10-21.json). Não há credenciais, cookies, conteúdo de produção ou logs de servidor no JSON. Logs completos ficam fora do Git, em `/workspace/mds-crm-onboarding-evidence/comments-delete/`.

## Dependências auditadas

`checkAuth` e `checkPermission` revalidam usuário, organização e papel no banco; foram reutilizados sem alteração. A busca de escritores em `src/app/api` encontrou: POST de comentários (única criação, valida pai/entidade e usa `FOR SHARE`); PUT de comentários (atualiza conteúdo); exclusão de Tarefa (remove comentários com filtros locais); LGPD/delete-account (anonimiza conteúdo, sem trocar organização/pai/autor). Esses handlers foram inspecionados para entender referências e locks, sem modificá-los; a inspeção não substitui homologação integral de cada fluxo.

## Correção delimitada

Único arquivo funcional: `src/app/api/comments/[id]/route.ts`. Reutilizados `checkAuth`, `checkPermission`, política de autor/owner/admin e mapa de permissões existentes, sem novo mecanismo de autorização.

1. Autenticação/usuário/organização ativos antes do lookup; associação ativa bloqueada para alterações concorrentes durante a transação.
2. Lookup e lock do comentário limitados à organização e ao autor pertencente a ela. Nenhum conteúdo estrangeiro é retornado. Tipo não reconhecido é rejeitado, sem fallback de permissão no DELETE.
3. Permissão `delete` e papel **atual do banco**, não o papel antigo da sessão. Autor pode excluir; owner/admin podem moderar somente dentro da organização e com a permissão existente.
4. Entidade validada na organização e bloqueada até commit; no Kanban, card → coluna → board. Pai e descendentes devem coincidir em organização, tipo, entidade e autor local. Relações inconsistentes geram erro genérico e nenhuma exclusão; dados históricos não são reescritos.
5. Árvore local descoberta e bloqueada antes de uma exclusão com filtros completos. `ReadCommitted` permite observar respostas confirmadas antes da aquisição dos locks; o POST existente usa lock compartilhado no pai, coordenando-se com o lock exclusivo do DELETE. Ciclos inconsistentes são rejeitados.
6. Tudo na mesma transação. Contagem efetivamente excluída deve coincidir com a árvore validada, ou ocorre rollback. SQL parametrizado; nomes de tabelas pertencem a um conjunto fechado.

O PUT teve **somente** a variável local `module` renomeada para `permissionModule`, exigência do lint Next; lógica e política de PUT intactas. GET/POST, helpers centrais, módulos/provedores, schema, workflows e controles comerciais não foram modificados.

## Execução e resultados

Node **22.21.1**; banco autorizado em loopback, guardado pelos helpers. Nenhuma migration executada. Servidor iniciado diretamente por `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100`; não foi usado `npm start`, cujo prestart aplica migrations. Segredos de sessão do runner são sintéticos, gerados em memória e não publicados.

| Comando/verificação | Resultado |
|---|---|
| `node tests/comments-delete-http.mjs`, build anterior e corrigido | Antes 31/62 falham; depois 62/62 passam |
| `node tests/comments-tenant-http.mjs` | 53/53 PASS, regressão GET/POST preservada |
| `node scripts/block2-c6-ci.mjs node` | **137/137**, zero FAIL/SKIP/TODO; inclui oito testes DELETE novos e os seis GET/POST |
| `node --import tsx --test tests/*.test.ts` | **383/383** |
| `node scripts/block2-c6-ci.mjs http` | Seis probes C0–C5 PASS: Dashboard, comercial, White-Label, cross-tenant, acesso direto e Tarefas/OS |
| `node node_modules/typescript/bin/tsc --noEmit` | PASS |
| `npm run build` | PASS; arquivo gerado `next-env.d.ts` restaurado ao conteúdo rastreado |
| `node node_modules/eslint/bin/eslint.js --max-warnings 0 src/app/api/comments/'[id]'/route.ts tests/comments-delete-http.mjs tests/comments-delete-postgres.test.mjs` | Zero erros e avisos, sem mudança de regras |
| `git diff --check` | PASS |

Os oito testes novos usam handlers, autorização, validação e PostgreSQL reais, isolando apenas o transporte da sessão. Incluem: negações por papel/tenant; relações históricas inválidas em profundidade; autenticação e associação inativas; permissão, autoria e moderação legítimas; rollback após DELETE real seguido de falha injetada; locks que impedem transferência de organização da raiz/resposta/entidade e alteração do papel durante a operação; dois DELETE concorrentes (`200` e `404`); corrida com POST sem persistência órfã.

### Limitação reproduzida na corrida com POST

Se o DELETE vence enquanto o POST tenta criar uma resposta, o PostgreSQL rejeita o POST com `SQLSTATE 40001`, exposto pelo Prisma como `P2010`. O handler POST existente devolve **HTTP 500 genérico**, pois ainda não mapeia esse erro raw para `409`. **Zero respostas órfãs**, sem dados sensíveis na resposta; mas o erro transitório de disponibilidade permanece.

O teste novo inicialmente exigia `400/409` e falhou; a investigação confirmou a causa PostgreSQL. A asserção final exige precisamente **500 + P2010/40001 + zero gravações**, documentando a limitação existente, sem chamá-la de corrigida nem aprovar disponibilidade. Não foi alterado o GET/POST fora do escopo autorizado. Tratar o mapeamento de conflito/retry em autorização própria antes de concluir a homologação de concorrência da família de comentários.

## Atualização G2/G3 e riscos residuais

| Gate | Evidência nova | Estado |
|---|---|---|
| G2 | Exclusão por permissão/papel atual/autoria; lookup só após auth; erros genéricos; nenhum DELETE indevido ou alteração parcial nos probes | P1 DELETE reproduzido e corrigido localmente; **gate não aprovado integralmente** |
| G3 | Tenant em comentário, autor, entidade, pai e árvore; foreign cascade impedido; locks, rollback e ausência de efeitos estrangeiros | Recorte DELETE validado; **gate não aprovado integralmente** |
| G1/G4 | Suítes existentes repetidas, nenhuma alteração nesses domínios | Sem aprovação nova |
| G5 | `observe_only`, `APPROVED_ENFORCEMENTS` vazio e arquivos comerciais intactos | Sem autorização de enforcement/rollout |
| G6 | Commit/evidência local para revisão da PR #15 | CI remota do novo SHA, revisão independente e aceite pendentes |

Esta atualização substitui especificamente a pendência DELETE registrada no relatório anterior de comentários, sem apagar a evidência histórica. Mantêm-se: 500 transitório do POST descrito acima; PUT não auditado/certificado neste recorte; ausência de FK/constraint polimórfica e necessidade de outros escritores respeitarem os contratos; relações históricas inválidas ficam preservadas/em quarentena; sem ensaio de carga para árvores profundas/locks. Contagem de vínculos inconsistentes não retorna conteúdo/IDs estrangeiros ao cliente. Não houve saneamento de dados existentes.

O novo teste PostgreSQL é descoberto automaticamente pelo runner Node atual. Os dois probes HTTP de comentários foram executados localmente; não foram acrescentados à lista fixa de seis probes C6 nem houve alteração dos workflows. Alertas de dependências, lacunas comerciais e riscos de providers anteriores permanecem fora deste lote.

Nenhum gate G1–G6 aprovado automaticamente; piloto não liberado. Sem push, nova PR, merge, deploy, migrations ou alterações em produção/Coolify. Próximo passo: autorização para atualização da PR Draft #15, CI no SHA enviado e revalidação independente; separar a correção do erro transitório do POST.

Rollback proposto, não executado: revert isolado deste commit em branch de revisão. Sem schema/dados a reverter. O revert reintroduz a exclusão cross-tenant e não é candidato seguro para publicação; manter piloto bloqueado até correção alternativa validada.
