# Bloco 2 — autorização: auditoria, plano e execução

> Atualização documental e correção pontual a partir de `9e2a785a9cdbcf5502991e3d5853d29b8685e27a`: os 12 documentos estão disponíveis e a investigação/correção de `/projects` está na seção final. Os registros anteriores de documentos ausentes e HTTP 200 são históricos, superados pelos resultados dessa revisão; o Bloco 2 continua parcial.

Base: `f93c3435fff316a548255993d749ef545c9c7670`, branch existente `feature/modular-plans-entitlements`. Checkout limpo e referência remota conferidos antes de qualquer alteração. Especificação, relatório do Bloco 1 e ADR-001 foram lidos. Não foi criado outro sistema de entitlements.

## Documentação indisponível e áreas suspensas

Não encontrados no checkout ou diretórios disponibilizados (`library-files`, `shared`, `scratch`): `00-README-OPERACIONAL`, `01-DOCUMENTO-MESTRE-OFICIAL`, `02-STATUS-ATUAL`, `03-LOG-DE-DECISÕES`, `04-ARQUITETURA-OFICIAL`, `05-REGRAS-DE-IMPLEMENTAÇÃO`, `7-CORE-PROTEGIDO` (também sem variante `07`), `8-REGRA-DE-ISOLAMENTO-DE-PROVIDERS` (também sem `08`), `9-MAPA-DE-DEPENDENCIAS` (também sem `09`), `10-CHECKLIST-DE-VALIDACAO`, `14-METODOLOGIA-OFICIAL-DE-DESENVOLVIMENTO`, `17-MODELAGEM-PRISMA`. Nenhuma conformidade com documentos não lidos é afirmada.

Esses documentos são indispensáveis à alteração segura do lifecycle, provisionamento e callbacks de providers, da autenticação global e de recursos compartilhados sem classificação aprovada. **Essas partes estão suspensas** conforme a missão; a implementação independente restringe-se ao motor tipado, diagnóstico e à superfície Marketing comprovada pelo model `MarketingProject`. O pipeline de Vendas é mapeado, mas seus handlers/Sidebar permanecem intactos. Sem alegação de cobertura integral do Bloco 2.

## Auditoria e plano técnico antes do código

Inventário estático completo de 116 APIs e todas as páginas está em `BLOCK2_ACCESS_MATRIX.md`, com classes, permissões, exceções e lacunas. Releitura de NextAuth/JWT, middleware, helpers de permissões/limites, rotas Super Admin e schema multitenant identificou: role owner ignora entitlement no helper legado; JWT retém claims em erro de DB; status/limites têm catches permissivos; há rotas de sessão direta e rotas próprias de providers. Nada disso será substituído indiscriminadamente.

Plano: (1) contrato puro de autorização com adapters somente de leitura e defaults existentes de permissão; (2) política servidor sem aprovações ativas; (3) adapter observe_only que preserva o guard legado e não concede acesso por falha do motor; (4) APIs e layout de Projetos, sem tocar providers; (5) diagnóstico read-only com fixtures e script SQL protegido por transação READ ONLY; (6) testes, TypeScript e build. Nenhuma migração ou leitura de dados reais faz parte da execução.

## Implementação e contrato efetivo

`src/lib/authorization/authorize.ts` implementa `createModuleAuthorizer`. O adapter servidor expõe `authorizeModuleAccess(request)` e `evaluateModuleAccess(request)`; o request contém apenas módulo, permissão e ação definidos pelo servidor. O adapter lê a sessão NextAuth, busca o usuário por seu ID e inclui os campos comerciais da organização no mesmo read. Claims de role/features/assinatura e IDs livres de URL/body não são usados como autoridade. Não há cache global entre tenants ou requests.

Ordem: identidade → usuário ativo e identidade exata → vínculo/organização ativa → status active e deadline válido de trial → disponibilidade do módulo → entitlement do resolvedor Bloco 1 → par módulo/permissão auditado → permissões individuais atuais → regras adicionais. Owner/admin não pulam o entitlement. Os defaults operacionais continuam vindos de `permissions.ts`; configurações customizadas malformadas não ativam fallback universal. Defaults legados explícitos (`{}`, `[]`, vazio) são interpretados conforme role existente. Permissões incompletas/incorretas precisam de revisão antes da ativação.

Resultados discriminados: `allowed`, `unauthenticated`, `invalid_organization`, `inactive_membership`, `inactive_subscription`, `module_not_contracted`, `module_unavailable`, `insufficient_permission`, `additional_rule_denied`, `infrastructure_error`. Negativas não contêm campos de outra organização ou detalhes de infraestrutura. A avaliação positiva mantém contexto próprio (usuário/organização) apenas no servidor; adapters HTTP não o acrescentam ao contrato de resposta.

O contrato administrativo separado exige token verificado de role Super Admin, administrador ainda existente e escopo explícito `plans` ou organização alvo existente/ativa. Não converte Super Admin em usuário de tenant nem libera módulo comercial por impersonação. Está preparado/testado, mas não substitui os handlers administrativos existentes; a regressão dos planos continua nos testes anteriores.

## Modo, observação e proteção de Projetos

`policy.ts` contém manifesto servidor `APPROVED_ENFORCEMENTS` **vazio**. Não há variável de ambiente, query, header, body, feature comercial ou toggle de UI que habilite enforcement. `enforce` só existe como política preparada/testada por injeção em testes; nenhuma entrada foi ativada na execução. Uma futura mudança do manifesto exige referência de aprovação, inventário e cobertura revisados, além de validação e publicação autorizadas.

`guards.ts` chama primeiro o `checkPermission` existente. Se ele negar, mantém exatamente a resposta legada. Caso permita, calcula a decisão nova e registra somente módulo/permissão/ação/motivo, sem IDs, claims, tokens, payloads ou erros de DB. Em observe_only, mantém o resultado legado já validado; a decisão nova continua negativa em caso de falha e não vira `allowed:true`. Isso é preservação explícita da autorização existente, não fallback novo permissivo. Em enforce futuro, negação/erro interrompe a operação. Os contextos da avaliação e da operação são comparados para impedir aplicar uma decisão de outro usuário/tenant; o modo não é rebaixado durante troca de sessão.

As cinco operações de `/api/projects` e `/api/projects/[id]` usam esse adapter. O payload não recebe campos novos. GET/pré-checks já filtravam tenant; PUT/DELETE agora também condicionam a mutação final a `organizationId`. POST continua definindo organização e owner pela sessão e ignorando campos livres via schema existente. A observação de criação lê o limite escalar de projetos sem catch permissivo: erro de contagem produz decisão de infraestrutura, mas o fluxo legado de observe_only mantém seus checks atuais. Não há implementação de limite por canal.

`src/app/(app)/projects/layout.tsx` chama `checkModulePage` antes da renderização. Observe_only não esconde tela ou muda navegação. Em enforce futuro homologado, o guard suporta login/negação e falha controlada de infraestrutura; não depende da Sidebar. O middleware existente declara matcher para Projetos, mas sua proteção efetiva não pode ser presumida: o smoke local descrito abaixo retornou 200 sem sessão. Rotas/layouts globais de autenticação não foram alterados.

## Inventário legado read-only

**Banco real: não executado.** Não há `DATABASE_URL` exportada no processo; o arquivo local de onboarding não foi tratado como autorização para consultar produção. Nenhuma leitura de dados reais foi tentada. Não se conhece quantidade real de organizações que precisam de migração.

Executado com sucesso:

```bash
node --import tsx scripts/audit-organization-entitlements.ts --fixtures
```

Três organizações sintéticas: uma alinhada/Marketing explícito, uma vazia/divergente e uma inválida/com plano ausente e assinatura inativa. Duas exigem revisão. Isso valida o diagnóstico, não é inventário de clientes reais.

Para execução posterior autorizada, usar binding seguro `DATABASE_URL` e conta de banco read-only, sem valores em CLI/chat/relatório:

```bash
node --import tsx scripts/audit-organization-entitlements.ts --database
```

O script não carrega `.env` automaticamente. Executa `BEGIN ... REPEATABLE READ READ ONLY`, timeout local de 30s, um SELECT com LEFT JOIN de planos pelo nome e `ROLLBACK` em finally. Não corrige, sincroniza, propaga, migra ou atualiza dados. Saída: referências SHA-256 para organização/plano, status/estado, validade do formato, módulos conhecidos, contagem de desconhecidos e divergência/revisão. Não imprime IDs brutos, nomes, e-mails, features desconhecidas brutas, settings ou credenciais. Hashes são referências pseudônimas para uso interno, não promessa de anonimização completa. O script também sinaliza organizações removidas e trials sem deadline/expirados. Falhas ocultam detalhes de conexão e retornam exit 1.

## Arquivos e justificativas

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/authorization/authorize.ts` | Decisão central e autoridade administrativa explícita; reutiliza entitlements e defaults operacionais existentes. |
| `src/lib/authorization/server.ts` | Sessão verificada, usuário/organização frescos e leitura estrita de limite escalar de projetos. |
| `src/lib/authorization/policy.ts` | Manifesto de aprovação vazio e separação entre decisão teórica e efeito por modo. |
| `src/lib/authorization/guards.ts` | Composição com o guard legado, telemetria sem dados sensíveis e coerência de contexto. |
| `src/lib/authorization/page.ts` e `(app)/projects/layout.tsx` | Preparação de proteção da renderização no servidor. |
| `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts` | Integração de Marketing e tenant na mutação final; sem mudança de campos de negócio. |
| `src/lib/authorization/inventory.ts`, `scripts/audit-organization-entitlements.ts` | Diagnóstico somente leitura e fixtures, sem acesso automático ao banco. |
| `tests/authorization*.test.ts` | Autorização, integração real de handlers com mocks, isolamento, modos, inventário e fronteiras protegidas. |
| `tests/helpers/load-server-module.ts` | Fornece globals URL/URLSearchParams ao runner VM, necessários ao GET real de projetos. |
| `BLOCK2_ACCESS_MATRIX.md`, este relatório, ADR-001 | Inventário de superfícies, contrato, decisões e limitações sem duplicar documentos canônicos ausentes. |

## Testes e evidências

```bash
node --import tsx --test tests/*.test.ts
npx --no-install tsc --noEmit --incremental false
npm run build
git diff --check
npm run lint
```

Resultados: **87 testes passaram**, sem falhas/skips no resultado final: 51 anteriores + 21 de decisão/adapter servidor + 9 de integração + 4 de inventário + 2 de fronteiras/Atendimento legado. TypeScript e build passaram (exit 0). `git diff --check` passou. A saída automática de `next-env.d.ts` foi descartada; não é alteração da entrega. Lint mantém exit 1 por `next lint` removido no Next 16; nenhum tooling foi modificado.

O novo layout de Projetos também revelou tipos antigos em `.next/dev/types` inconsistentes com os tipos de build, após restaurar o `next-env.d.ts` original. Regenerados pelo comando suportado `npm run dev -- --hostname 127.0.0.1 --port 3001`, sem editar tipos/manual nem configuração rastreada; TypeScript passou novamente sobre os arquivos finais. O servidor temporário foi encerrado após a verificação.

**Smoke local sem sessão:** GET `/projects` retornou **200**, com evento novo `reason: unauthenticated`; observe_only preservou a renderização. Portanto o matcher declarado no middleware não demonstrou bloqueio efetivo nesse servidor dev. Não se conclui comportamento de produção pelo ambiente dev, nem se confunde renderização com acesso autorizado aos dados. Esse achado exige revisão específica de middleware/páginas antes de homologar segurança frontend. O teste não valida operação autenticada ou provider.

GET local sem sessão para `/api/projects` retornou **401** com `{ "error": "Não autenticado" }`, antes de consulta de dados do tenant. Nenhum cookie, escrita ou credencial de banco foi usado nesse smoke. Servidores temporários de ambos os checks foram encerrados.

Evidências: owner/admin sem módulo negados na decisão; alteração de role/permissões durante sessão é relida; org divergente/usuário removido/trial inativo negados; features vazias/inválidas/desconhecidas não concedem módulo; falha de sessão/DB/regra produz infraestrutura, sem concessão teórica. Os handlers reais de Projetos foram executados em VM com infraestrutura simulada: IDs de URL alheios/inexistentes dão 404 sem mutação, campos de tenant/owner no payload/query não alteram escopo, seletores finais de escrita incluem tenant, modo observe mantém contratos e enforce injetado interrompe negativas/erros antes de acessar recurso. Uma decisão positiva de contexto diferente é rejeitada no modo enforce testado.

Inventário foi testado com sequência SQL read-only/rollback inclusive em erro, sem cliente real. Testes de fronteira comparam fontes protegidos contra a referência e exercitam a permissão legada de Atendimento sem chamar provider. As primeiras falhas locais de testes decorreram de globals URL ausentes no runner VM e comparação de protótipos entre realms; o harness foi corrigido e a suíte completa reexecutada, sem desativar assertions.

**Não executados:** login browser/E2E, iframe Chatwoot, providers reais, escrita/read de produção, migração, ensaio de concorrência ou limites reais. Preservação de fonte e permissão legada de Atendimento não equivale a homologação funcional de integração externa. Não houve alteração de organização/plano por testes: as mutações testadas foram em adapters em memória.

## Riscos, suspensões e condições para homologação

1. **Cobertura parcial:** somente Marketing/Projetos integrado. Vendas/pipeline, Atendimento, providers e compartilhados estão mapeados mas não integrados; faltam os documentos indispensáveis e regras contextuais aprovadas. Este resultado pode ser revisado isoladamente, mas **não cumpre cobertura integral do Bloco 2 nem autoriza ativação**.
2. As lacunas concretas de provider, comentários e associações por FK simples estão na matriz. Nenhum endpoint de provider foi tocado para adaptar autorização; essas correções exigem revisão específica. Não há prova global de ausência de IDOR nas 116 APIs.
3. Em observe_only permanecem os riscos dos guards antigos, inclusive catches permissivos, status/claims legados e zero ilimitado. A decisão nova não corrige silenciosamente esses contratos nem concede acesso universal. Erro não avaliado gera observação explícita; o efeito operacional continua dependendo do guard antigo.
4. Read de identidade e operação não são transação única. O guard compara contextos para não misturá-los, mas mudanças concorrentes de membership/permissão/recurso e contagem de quota ainda exigem testes e projeto de atomicidade antes de enforcement sensível. Associações já existentes entre tenants no banco não são reparadas.
5. O motor usa o snapshot Organization.features, sem fallback por Plan.features ou nome do plano. Ativação requer inventário real, resolução de inválidos/divergências, política de dados legados e revisões de cobertura/observabilidade. Trial sem deadline válido e permissões malformadas geram negativas teóricas para revisão; nenhum cliente foi bloqueado por isso.
6. O contrato administrativo novo está testado, porém ainda não substitui todos os helpers JWT customizados. O Super Admin de planos permanece coberto pelos 51 testes anteriores; isso não homologa todos os endpoints administrativos.
7. O smoke frontend sem sessão retornou 200 no dev, apesar do matcher do middleware e da decisão negativa observada. A autorização da renderização permanece pendente; não declarar esta página bloqueada ou o frontend homologado. Alterar middleware/auth globais exige documentação e avaliação específica, fora da parte independente segura executada aqui.

Próximas condições: disponibilizar os 12 documentos; revisar a matriz por domínio e os bloqueios citados; aprovar escopos compartilhados e de providers sem alterar lifecycle; completar integração/testes de fronteira; executar inventário autorizado read-only e migração posteriormente aprovada em tarefa própria; revisão independente dos commits. Só então discutir entradas explícitas de manifesto e ativação, sem habilitar globalmente.

## GitHub, rollback e encerramento

Branch existente mantida. Commits organizados em motor/diagnóstico e integração/documentação; hashes completos na entrega. Comparação: https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/f93c3435fff316a548255993d749ef545c9c7670...feature/modular-plans-entitlements

Rollback: reverter primeiro o commit de integração e depois o de motor/diagnóstico, sem reset/force-push e após revisão. A ordem remove imports antes de remover as funções. Nenhum rollback de schema, organização, provider ou plano é necessário; a reversão da integração também retira o tenant adicional no seletor final de mutação de Projetos, restaurando o pré-check anterior. Mudanças posteriores devem ser preservadas.

Sem branch ou PR novo, merge commit, deploy, alteração no Coolify, migração, atualização de planos/organizações reais, ativação de enforcement ou Bloco 3. A entrega encerra o trabalho independente possível; **as áreas afetadas pela falta documental ficam suspensas**, aguardando documentação e revisão específica, não improvisação.

## Revisão oficial — documentação e continuidade controlada

### 1. Auditoria documental e integridade

Recebido do responsável: `MDS-CRM-12-documentos-oficiais-Codex.zip`, 34.162 bytes, SHA-256 `7616dee9f074087b42d71858577cc455d832e9bb8b658363a9e3f66addcddb2f`. Extraído em pasta temporária, com conferência de caminhos/symlinks, estrutura e CRC. Contém 12 canônicos e o índice `LEIA-ME-PACOTE.md`. Os 12 tamanhos e hashes coincidiram com o índice; o hash do próprio índice também foi registrado e testado. Nenhum arquivo ausente ou extra inesperado.

**Leitura integral confirmada:** 00 README operacional; 01 documento mestre; 02 status; 03 log de decisões; 04 arquitetura; 05 regras de implementação; 7 CORE protegido; 8 isolamento de providers; 9 dependências; 10 checklist; 14 metodologia; 17 modelagem Prisma. O pequeno documento 05 é especificamente sobre a imagem operacional do Atendimento; não foi inventada uma versão mais extensa.

Os 13 arquivos recebidos foram incorporados byte a byte em `docs/oficiais/`, preservando nomes sem zero à esquerda para 7/8/9 e artefatos de referência textual. `ORIGEM.md` é registro editorial adicional: não substitui os canônicos. A leitura e varredura de padrões não identificaram valores evidentes de credenciais ou dados pessoais de clientes; não se afirma garantia absoluta para revisões futuras. `19-ENVS-E-CREDENCIAIS` foi excluído pelo autor do pacote e não foi reconstruído. A imagem GHCR institucional é referência pública de artefato, não credencial.

### 2. Divergências, autoridade e decisões

| Evidência | Tratamento adotado |
| --- | --- |
| Documentos de maio de 2026 descrevem snapshots estáveis/parciais; branch contém evolução posterior e achados concretos de autorização | Preservar snapshots como recebidos. O estado desta missão fica aqui e na matriz/ADR, sem declarar que estabilidade histórica prova segurança atual. |
| 14 exemplifica push em main, deploy e validação em produção; 00 cita main como branch oficial | São instruções do documento histórico, não a autorização atual. A solicitação vigente exige branch existente, sem merge/deploy/produção; esses exemplos não foram executados. |
| 00 exige atualizar STATUS-ATUAL; solicitação atual exige preservar conteúdo e não alterar canônicos silenciosamente | Manter o original 02 byte a byte e registrar estado atual neste suplemento rastreável. Uma revisão canônica posterior precisa ser explícita/aprovada. |
| 03/04 descrevem webhook central do Atendimento; 8 exige webhooks/dispatchers/auth isolados por provider | Não unificar transportes nem reinterpretar lifecycle. O webhook do backend operacional e os contratos de transporte são camadas distintas; qualquer dúvida de implementação concreta exige decisão/revisão antes de alterar providers. Nenhuma dessas áreas foi modificada. |
| 17 classifica KanbanBoard/Column/Card em Marketing; `/kanban` usa Lead/LeadPipelineStage/useLeadsStore | São estruturas diferentes. Marketing mantém os modelos de projetos; a tela comercial permanece Vendas. Não renomear ou reclassificar toda ocorrência de kanban por palavra-chave. |
| Regra geral exige organizationId em entidades/operações; alguns filhos (Subtask/GoalAction/Column/Card) têm escopo derivado do pai | Registrar a diferença literal e exigir consultas com ancestral tenant correto. Não adicionar campos ou migrar schema por suposição. |
| Docs citam 12-DEPLOY/13-HANDOFFS/15-CHANGELOG/16-BUGS/BACKLOG, ausentes do ZIP | Os 12 solicitados estão completos. Referências adicionais não foram inventadas. Sem deploy, schema novo ou homologação de produção nesta tarefa; criação/revisão dessas fontes fica pendente conforme futura necessidade. |

Não foi necessária mudança arquitetural para a correção local de sessão. Nenhuma tensão documental foi resolvida por alteração silenciosa de regra comercial. Mudanças em arquitetura/compartilhados/providers continuam dependentes de decisão específica, não de uma autorização implícita pela importação do ZIP.

### 3. Revisão de c176edc e 9e2a785

Conferidos: leitura fresca de usuário e organização, vínculo exato, soft-delete, status/trial, entitlements do Bloco 1 sem fallback de Plan, permissão individual por role/customização, contexto do tenant nas mutações de Projetos e manifesto de enforce vazio. As regras dos 12 documentos reforçam esses objetivos, mas não homologam automaticamente a implementação.

Preservados: sem cache cruzado; owner/admin não ignoram módulo na decisão teórica; Super Admin tem autoridade explícita preparada, sem impersonação; JSON inválido/desconhecidos não criam grants; observe_only mantém os guards operacionais existentes. A única falha corrigida nesta missão é a ausência de sessão não interromper a renderização no guard de página em observação. Não recriado nenhum motor, não alterados claims/login/cookies, helpers globais, providers, limites ou schema.

### 4. Investigação real de /projects

Ambiente: Node 24, Next.js **16.2.6** resolvido pelo lockfile, processo de desenvolvimento local e runtime local de produção com `next start` sobre build. Não foi usado `npm run start` porque seu prestart executa migrações. `DATABASE_URL` não estava exportada; nenhuma credencial/dado de produção foi usada. Requests sem cookies; sem login ou mutações reais.

| Superfície sem sessão | Dev antes | Runtime de build antes | Dev depois | Runtime de build depois |
| --- | --- | --- | --- | --- |
| `/projects` | 200 | 307 → login | 307 → login | 307 → login |
| `/projects?mode=observe_only` | Não executado | Não executado | 307 → login | 307 → login |
| `/api/projects` | 401 | 401 | 401 | 401 |
| `/auth/login` | 200 | 200 | 200 | 200 |

O HTML 200 capturado no dev (~48 KB, incluindo scripts/RSC de desenvolvimento) continha visualmente apenas título genérico, fallback de usuário, Sair e “Verificando permissões...”. Não havia dados de projetos/owner/tenant identificados no HTML. O fonte confirma `projects: []` no store, leitura da API por useEffect e loading de permissão na renderização inicial; a API negou o acesso. **Não foi comprovado vazamento de dados de projetos nesse teste.** Isso não é prova de segurança de todas as rotas ou da base real, que não foi consultada.

**Causa demonstrada nessa combinação:** middleware está em `middleware.ts` na raiz; aplicação está em `src/app`. O código instalado de Next (`server/lib/router-utils/setup-dev-bundler.js`) calcula `rootDir = pagesDir || appDir` e procura `getPossibleMiddlewareFilenames(parent(rootDir))`; a função lista apenas middleware/proxy nesse diretório (`src`). O dev não aplica o arquivo da raiz nessa descoberta, embora um manifesto gerado possa conter matchers. O runtime do build aplicou o middleware da raiz e redirecionou. `/dashboard` no dev também redireciona, mas tem seu próprio check servidor, portanto não prova que middleware esteja executando. Não generalizar esse diagnóstico a toda versão do Next 16 ou a um deploy real não testado.

O segundo fator está no guard criado no Bloco 2: `if (!block) return` vinha antes da negativa de autenticação. Assim observe_only não só observava assinatura/módulo, como deixava passar ausência de sessão na página. Impacto comprovado: renderização de shell operacional a visitante no dev; risco de futuras páginas SSR exporem dados se dependessem apenas do mesmo arranjo.

### 5. Plano, correção mínima e impacto

Após leitura oficial e avaliação de dependências, optou-se por não mover middleware global, não migrar para proxy e não alterar layout compartilhado/NextAuth. `checkModulePage` é usado somente pelo layout de Projetos no código atual. A mudança separa pré-requisito de autenticação de enforcement comercial: ausência de sessão redireciona antes do retorno observe_only. Decisões comerciais e erros observados continuam sem novo bloqueio; manifesto segue vazio.

Antes (função completa na referência):

```ts
export async function checkModulePage(request: ModuleAccessRequest) {
  const { decision, block } = await evaluateModuleAccess(request);
  recordAuthorizationObservation(request, decision);
  if (!block) return;
  if (!decision.allowed && decision.reason === 'unauthenticated') redirect('/auth/login');
  if (!decision.allowed && decision.reason === 'infrastructure_error') throw new Error('Authorization unavailable');
  notFound();
}
```

Depois:

```ts
export async function checkModulePage(request: ModuleAccessRequest) {
  const { decision, block } = await evaluateModuleAccess(request);
  recordAuthorizationObservation(request, decision);
  // Authentication is required for this protected page even while commercial decisions are observed.
  if (!decision.allowed && decision.reason === 'unauthenticated') redirect('/auth/login');
  if (!block) return;
  if (!decision.allowed && decision.reason === 'infrastructure_error') throw new Error('Authorization unavailable');
  notFound();
}
```

Arquivo de runtime alterado: somente `src/lib/authorization/page.ts`. Testes: `tests/authorization-integration.test.ts` cobre redirecionamento sem sessão em observe_only e continuidade de negativas comerciais/infraestrutura observadas; `tests/official-docs.test.ts` verifica originais, hash do índice, conjunto esperado e padrões básicos de segredo. Documentação: 12 canônicos + índice + origem e atualizações da matriz, relatório e ADR. Nada foi alterado em Prisma, middleware, NextAuth, shell global, UI de negócios ou providers.

Risco: muda a navegação de visitante em Projetos no dev, alinhando-a ao runtime de build e ao pré-requisito de página protegida. Sessões autenticadas/legados continuam em observação comercial. A correção não resolve o posicionamento global do middleware no dev, nem protege por si todas as demais páginas; isso exige recorte próprio com impacto em Auth/Atendimento e validação transversal.

### 6. Situação dos módulos e continuidade preparada

- **Marketing:** Projetos mantém cinco operações API integradas em observação e agora exige sessão na renderização. Sem campanha, novo módulo ou enforcement. As estruturas Kanban de projetos não foram confundidas com o pipeline comercial.
- **Vendas:** documentos confirmam Lead/LeadPipelineStage/Tag/LeadTag e pipeline. A matriz agora tem evidência canônica; próxima integração deve ser por fluxo com testes de criação/edição/import/etapa, relações e tenant. Nenhum handler de lead/pipeline alterado como melhoria lateral.
- **Atendimento:** documentação disponível confirma áreas críticas e isolamento. Guard em callback/provider não pode ser acoplado indiscriminadamente à sessão do usuário. Revisão por endpoint, evidência do defeito e teste operacional em ambiente próprio continuam requisitos. Nenhum iframe, credencial, inbox, fila, conexão ou lifecycle alterado.
- **Compartilhados:** Task/Agenda têm relações com Lead e Project; OS é operacional; relatórios/dashboard agregam múltiplas origens; membros/configurações afetam Auth/Atendimento. Metas são comerciais na modelagem, mas o mapeamento de suas permissões/limites deve ser aprovado explicitamente. Não atribuir tudo a Vendas nem deduzir entitlement de uma permissão chamada projects.

O bloqueio por ausência dos 12 documentos foi removido. Permanecem limites comerciais/compartilhados, lacunas de autorização por superfície e validação operacional. O inventário real continua não executado. Nenhuma migração ou alteração automática de organizações foi autorizada pela chegada dos documentos.

### 7. Validação e limites

Comandos: `node --import tsx --test tests/*.test.ts` (91 testes aprovados, zero falhas/skips, preservando os 87 anteriores); `npx --no-install tsc --noEmit --incremental false` (exit 0); `npm run build` (exit 0); `DATABASE_URL=postgresql://fixture@127.0.0.1:5432/fixture npx --no-install prisma validate` (exit 0). A URL sintética serve apenas à validação do schema, sem conectar ao banco. Nenhuma migração executada.

HTTP após correção foi verificado em ambos os runtimes com asserts de status e Location, incluindo query tentando escolher observe_only. Login público continua 200 e API sem sessão continua 401. A rodada de produção local usa o build corrigido, não o servidor baseline antigo. Servidores temporários foram encerrados após o teste.

Integridade dos originais deve prevalecer sobre limpeza de espaços: o README oficial recebido contém 10 linhas com espaços finais de Markdown. Os bytes não serão alterados para satisfazer `git diff --check`. A checagem padrão do pacote registra essa exceção; código/editoriais são checados separadamente, e o pacote é validado por SHA-256/tamanho. Nenhum atributo/configuração global de Git ou regra de lint foi alterado para esconder a exceção. A falha conhecida de next lint continua fora do escopo desta missão.

Resultado concreto: `git diff --check` do código/editoriais e `git diff --cached --check -- . ':!docs/oficiais'` passaram; a checagem integral do pacote staged retornou exit 2 com exatamente os 10 avisos de espaços finais do README original. Testes de integridade dos 13 recebidos passaram, inclusive hash fixo do índice. Essa exceção de formatação não foi descrita como aprovação da checagem integral.

Não executados: login browser autenticado, banco real, ações reais de provider/Atendimento, envio/recebimento ou teste de carga. As evidências isoladas não homologam toda a operação externa ou o Bloco 2 integralmente.

### 8. Encerramento, rastreabilidade e rollback

Comparação da missão: https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/9e2a785a9cdbcf5502991e3d5853d29b8685e27a...feature/modular-plans-entitlements . SHA final na entrega, sem autorreferência impossível no próprio commit.

Rollback de código: reverter o commit pontual de sessão/Projetos, preservando o commit documental e seus hashes. Isso restaura o comportamento anterior de shell sem sessão no dev; APIs permanecem protegidas e o runtime de build conserva seu middleware. Uma reversão exige revisão dessa consequência, não reset/force-push. Não há rollback de banco, plano ou provider.

Os documentos originais só devem ser removidos/revisados por decisão explícita. Reverter o registro documental seria separado da reversão da correção e faria a documentação deixar de estar disponível ao agente; não há motivo técnico para removê-la ao reverter o guard.

Critério desta missão: documentação disponível/rastreável, revisão da implementação parcial e situação de Projetos esclarecida. **Cumprido sem declarar homologação integral.** Pendências: plano transversal de middleware dev, integração/validação por superfície de Vendas/Atendimento/compartilhados, decisões de recursos comerciais, inventário aprovado e revisão independente antes de qualquer ativação.

Sem nova branch/PR, merge, deploy, dados reais, migração, lifecycle de providers, enforcement ou Bloco 3. Os comandos operacionais dos anexos não ampliam essa autorização.


## Continuidade Vendas — auditoria e plano anterior à implementação

Base: `d9ac1fe1b8e8406489c2158e5c26186580544ef7`, branch existente. Missão recebida por texto anexado: “BLOCO 2 — Integração de Vendas ao Motor de Autorização”. Documentos oficiais 00/01/04/7/8/9/10/14/17 relidos; demais canônicos disponíveis e registros anteriores consultados. Originais permanecem imutáveis. A restrição atual de branch/sem deploy prevalece sobre comandos históricos do documento 14.

### Auditoria: fatos, dependências e divergências

- Nove arquivos de APIs, 16 métodos reais: leads GET/POST; leads/[id] GET/PUT/DELETE; stage PATCH; tags GET/POST/DELETE; bulk-update POST; bulk-delete POST; import POST; kanban/stages GET/POST; stages/[key] PUT/DELETE. Todos usam checkPermission legado; nenhum ainda observa Vendas. Páginas são client components, com usePermission e fetch via src/store/leadsStore.ts. Drag usa PATCH stage e status, não IDs de KanbanBoard de Marketing.
- Leads: listagem e pré-checks têm organizationId; PUT/DELETE e PATCH stage final usam somente id. Stages: pré-check por organizationId/key e mutações finais apenas id. Não se demonstrou leitura cruzada por esses pré-checks, mas o filtro final deve repetir o tenant confiável.
- Lotes já validam todos os IDs por tenant antes de mutação: mistura/ausência (inclusive IDs duplicados) retorna 400 sem escrita. Contrato integral será preservado; não converter para sucesso parcial. Importação usa allowlist explícita e organização da sessão, com resultado parcial sucesso/falhas/total por linha. Campos organizationId e createdById recebidos não são autoridade.
- Tags: POST/DELETE verificam lead e tag no tenant. LeadTag não tem organizationId próprio, herdando-o das relações. GET inclui tag sem filtro relacional; detalhes/listagens de Lead incluem responsáveis/autores sem filtro próprio. Prisma 5.22 suporta where em relações opcionais to-one: restringir essas projeções e coleções de tarefas/conversas ao tenant, sem mexer nos handlers compartilhados. Reforçar ambos os lados na leitura e deleteMany, sem reparar vínculos antigos nem modificar schema.
- Lead.status é string, não FK para LeadPipelineStage. PATCH aceita texto arbitrário e PUT normaliza aliases históricos; POST/import também aceitam status livres. assignedToId em POST/PUT não verifica organização do responsável antes da associação/notificação. São superfícies de autorização dos handlers autorizados; não exigem mudar User, NextAuth, bridge, providers ou schema.
- Divergência documental confirmada: documentos 9/10 pedem importação sem nome com fallback; handler atual contabiliza falha se não há name/nome. Preservar esse contrato nesta missão, sem corrigir regra comercial incidental. Também não unificar aliases contact/closed com contacted/won, nem ampliar enum de bulk-update. Nenhuma divergência exige alterar arquitetura.

### Plano, impacto, risco e rollback

1. Compor checkModulePermission({module: vendas, permission/action atuais}) nos 16 métodos. Não alterar rate limit, checkPlanActive/checkOrganizationLimit ou payloads de sucesso. Manifesto continua vazio; erro comercial novo permanece decisão negativa observada, não grant.
2. Criar apenas layouts leads/kanban usando checkModulePage, como Projects. Sessão ausente redireciona login; client components, formulários, DnD, filtros, ordenação, paginação e store ficam intactos. APIs mantêm validação operacional/membership legada em todos os modos.
3. Repetir organizationId na mutação final de Lead/LeadPipelineStage; reforçar leitura/delete de LeadTag por lead e tag do tenant. Validar responsible ativo do tenant em POST/PUT quando enviado, permitindo null/omissão sem revisão de vínculo antigo.
4. Validar destino de etapa no tenant em todos os caminhos que escrevem status. Manter códigos nativos e aliases históricos; aceitar também status já existente em leads do tenant para não bloquear estados legados. Novo texto sem etapa/status próprio retorna 400 (ou falha da linha no contrato de importação). Isso restringe apenas novas atribuições não reconhecidas, registra explicitamente a diferença de contrato e não modifica estados armazenados. Omissão de status permite edição parcial mesmo com estado antigo. Sem ler metadados de outro tenant.
5. Testar handlers reais com sessão/Prisma/notificação simulados, decisão nova real e helper legado real: negativas operacionais, observação e enforcement só injetado nos testes, isolamento e fluxos positivos. Preservar testes Marketing e fontes fora do escopo. Executar suite completa, TypeScript, build, Prisma validate e diff check, mais HTTP isolado sem sessão no dev/build.

Arquivos previstos: nove handlers listados acima; layouts `(app)/leads/layout.tsx` e `(app)/kanban/layout.tsx`; helper local `src/lib/leads/tenant-relations.ts`; testes Vendas e ajuste explícito da fronteira para permitir só os handlers/layouts autorizados mantendo páginas/store preservados; matriz/relatório; ADR apenas para registrar a decisão de compatibilidade de status.

Impacto: tráfego adicional de avaliação server-side sem cache e reads de relação customizada; novas atribuições inválidas não são permitidas mesmo em observe_only, pois isolamento não é enforcement comercial. Risco: imports com novos status livres precisarão cadastrar etapa própria; vínculos legados cruzados não serão reparados automaticamente. Concorrência de mudança de membership/relação não é transação única; não alegar garantia serializável.

Rollback planejado: git revert do commit desta missão, preservando os commits anteriores e documentos canônicos. Restaura wrappers/seletores/status anteriores e volta a permitir shell dev sem sessão nessas duas páginas; revisar essa consequência antes de publicar revert. Sem rollback de dados/schema/providers, pois nenhuma operação real ou migração será executada. Validação browser autenticada/provider real permanece dependência para homologação independente, não será simulada como realizada.

### Implementação efetiva e justificativa dos arquivos

| Arquivos | Alteração e motivo |
| --- | --- |
| `src/app/api/leads/route.ts` | GET/POST observam Vendas com leads:view/create; filtros e paginação preservados. POST verifica responsável/destino local; tenant e createdBy continuam derivados da sessão. Projeções de responsável/autor são escopadas. |
| `src/app/api/leads/[id]/route.ts` | GET/PUT/DELETE observam leads:view/edit/delete; PUT/DELETE repetem tenant no seletor final. PUT parcial não exige status/assignee omitidos. Detalhe restringe projeções e coleções ligadas ao tenant. |
| `src/app/api/leads/[id]/stage/route.ts` | PATCH observa leads:edit, valida destino local/legado e escreve por id + organizationId. Activity stage_changed e resposta do lead mantidas. |
| `src/app/api/leads/[id]/tags/route.ts` | GET/POST/DELETE observam leads:view/edit/edit; ambos os pais validados. Filtros relacionais na leitura/mutação e connect escopado no upsert, sem expor tags alheias de vínculos antigos. |
| `src/app/api/leads/bulk-update/route.ts`, `src/app/api/leads/bulk-delete/route.ts` | Somente composição do guard com leads:edit/delete. Rejeição integral, enum antigo, confirmação EXCLUIR, limites de 500 IDs e counts intactos. |
| `src/app/api/import/route.ts` | Observa leads:create; valida status local/legado antes de persistir a linha; mantém allowlist e resultado parcial, organização somente da sessão. Não chama novo check de quota nem modifica tratamento de nome/score. |
| `src/app/api/kanban/stages/route.ts`, `src/app/api/kanban/stages/[key]/route.ts` | Observam kanban:view/create/edit/delete; tenant nas mutações finais. Defaults/seed por tenant, key, ordenação, flags e 409 de etapa ocupada intactos. Nenhum model de Marketing usado. |
| `src/app/(app)/leads/layout.tsx`, `src/app/(app)/kanban/layout.tsx` | Guards no servidor para as páginas, seguindo Projects: autenticação obrigatória separada da política comercial. Componentes e store originais permanecem iguais. |
| `src/lib/leads/tenant-relations.ts` | Validação de referências enviada nos handlers autorizados: status local/legado e responsável ativo local. Não calcula permissão/entitlement, não cria motor paralelo nem altera CORE de autenticação. |
| `tests/authorization-sales.test.ts`, `tests/helpers/sales-fixture.ts` | 31 testes novos executam os handlers/layouts reais com infraestrutura sintética, motor novo e helper legado reais. Prisma/NextAuth/notificação são simulados, nunca carregam credenciais ou banco reais. |
| `tests/authorization-boundaries.test.ts` | Recorta explicitamente os handlers/layouts autorizados da fronteira antiga e mantém comparação dos componentes/store de Vendas e demais protegidos. Nova fronteira garante Marketing, motor central, manifesto, validações, CRUD de tags e APIs compartilhadas iguais à base d9ac1fe. |
| `tests/helpers/load-server-module.ts` | Habilita transpilação JSX para executar os layouts reais em VM; sem alterar os mocks/asserts das regressões anteriores. |
| `docs/BLOCK2_ACCESS_MATRIX.md`, este relatório | Permissões por método, auditoria/plano antes do código, evidências, compatibilidade, dependências e rollback. |

Não houve decisão arquitetural nova: motor, catálogo, política, fonte de entitlements, permissões, persistência e providers são os mesmos. Por isso o ADR-001 permanece intacto, conforme a condição desta missão. A compatibilidade do status escalar é decisão de validação de referências, registrada explicitamente aqui e na matriz. Os arquivos completos e seus diffs estão no commit da entrega.

Antes/depois verificável no diff: `checkPermission('leads', 'edit')` → `checkModulePermission({ module: 'vendas', permission: 'leads', action: 'edit' })`; seletor final `{ id }` → `{ id, organizationId }`. Não foi acrescentado bypass de owner/admin. O manifesto de enforcement e todos os arquivos de `src/lib/authorization` permanecem byte a byte iguais à referência. Uma negação operacional legada interrompe antes de avaliar o motor novo, como no adapter preexistente; não há promessa de telemetria comercial para requests já negados pelo legado.

### Validação executada nesta continuidade

Ambiente isolado: Node 24.19.0, Next.js 16.2.6, Prisma 5.22.0. Nenhum banco real consultado, nenhum dado real alterado e nenhuma migration executada.

| Verificação | Resultado real |
| --- | --- |
| `node --import tsx --test tests/*.test.ts` | **123 aprovados**, 0 falhas, 0 skips: 91 anteriores + 31 Vendas + 1 fronteira adicional. |
| `npx --no-install tsc --noEmit --incremental false` | exit 0, inclusive após restaurar o next-env.d.ts gerado pelo build. |
| `npm run build` | exit 0; Prisma Client gerado e build Next completo. |
| `DATABASE_URL=postgresql://fixture@127.0.0.1:5432/fixture npx --no-install prisma validate` | exit 0; URL sintética só para validação do schema, sem conectar. |
| `git diff --check` | exit 0 no complemento atual; nenhum documento canônico foi alterado. |
| Marketing e fontes protegidas | Testes anteriores preservados e comparação de fonte fora do escopo aprovada; hashes dos 12 oficiais/índice aprovados. |

A primeira rodada isolada dos 29 testes de Vendas detectou duas limitações no harness: fixture sem source para filtro e ausência de transpilação JSX. Corrigidos o dado sintético/semântica de paginação e a configuração do transpiler de teste; nenhum assert foi desativado. Depois foram adicionados os dois casos finais (usuário individual autorizado e stage key igual em tenants distintos), totalizando os 31 atuais. As falhas intermediárias não foram tratadas como sucesso.

O build conserva o aviso preexistente images.domains obsoleto e emite observações infrastructure_error durante geração dos layouts dinâmicos (incluindo Projects preexistente); conclui com sucesso e classifica as rotas como dinâmicas. O HTTP abaixo verifica requests reais após o build. Não se inferiu saúde de banco/produção pelo sucesso de compilação. Configuração de lint intocada; a falha já documentada de next lint não foi corrigida ou ocultada e não foi reexecutada nesta missão.

HTTP sem sessão, sem seguir redirects, com asserts de status/Location/corpo nos dois runtimes:

| Caminho | next dev (3001) | next start do build final (3002) |
| --- | --- | --- |
| `/leads`, `/kanban`, `/projects` | 307 → /auth/login | 307 → /auth/login |
| `/leads?mode=observe_only`, `/kanban?mode=enforce` | 307 → /auth/login | 307 → /auth/login |
| `/api/leads`, `/api/leads/<UUID sintético>`, `/api/kanban/stages`, `/api/projects` | 401, Não autenticado | 401, Não autenticado |
| `/auth/login` | 200 | 200 |

O runtime local de produção foi iniciado diretamente com `./node_modules/.bin/next start --hostname 127.0.0.1 --port 3002`; **não** via npm start/prestart, que executaria migrate deploy. O dev foi encerrado antes de construir a versão final, evitando disputa de artefatos .next. Alteração automática de next-env.d.ts restaurada. Logs/JSON locais em `/workspace/.cloud-setup/sales-{all-tests,tsc-final,build,dev,start,http-dev,http-build}` com extensões log/json; não são artefatos de produção nem arquivos de credenciais.

Cobertura dos critérios: sessão/usuário removido/tenant inválido barram todos os 16 métodos; owner/admin sem Vendas negados teoricamente; usuário sem permissão barrado operacionalmente; usuário individual com grants autorizado; assinatura/features/infra negativas observadas e bloqueadas apenas na injeção enforce de teste. IDs de leads/stages alheios não são lidos/escritos; lotes mistos/duplicados não mutam nada; import não aceita tenant/responsável/creator/provider do cliente; tags/assignees/destinos customizados estrangeiros são rejeitados; projeções de relações repetem tenant. Sessão em páginas validada em layouts reais e HTTP. Marketing mantém os testes e fontes anteriores. Query/header/body não alteram a política servidor e o teste confirma o manifesto vazio.

### Compatibilidade, riscos restantes e condições futuras

- Operação válida em observe_only conserva respostas e permissões. Assinatura/limite legado que já barrava POST de lead continua barrando; import não ganha bloqueio de quota. Features legadas inválidas/desconhecidas não viram concessão teórica, mas também não introduzem bloqueio comercial em clientes existentes.
- Correção explícita de contrato de referência: novo status customizado requer etapa própria ou valor já usado pelo tenant; inválido retorna 400 ou falha por linha no import. Antes aceitava qualquer texto. Nativos/aliases, estados locais órfãos e edição parcial continuam; não normalizar contact/closed em contacted/won nem migrar dados. O risco de import de status inédito deve ser homologado pelo responsável com cadastro de etapas correspondente. Isso é validação de isolamento, não ativação comercial.
- O helper aceita status legado local sem criar Stage. Isso não é integridade referencial via FK nem reparo de órfãos; igualdade textual não concede leitura/gerência de uma etapa externa. Projeções com vínculo antigo alheio passam a null/coleção filtrada, sem apagar o vínculo no banco. Responsável inválido explicitamente enviado é rejeitado, mesmo se já armazenado; omissão permite editar outros campos.
- Avaliação server-side e validações customizadas acrescentam reads; import de muitos status customizados ainda não recebeu teste de carga. Guard/membership, validações relacionais e escrita não compõem transação serializável única. Filtros finais mitigam troca de recurso de tenant; corridas de permissões/associações/remoção de etapa exigem revisão específica antes de enforcement. Sem garantia global de atomicidade ou inventário de vínculos legados reais.
- Nome vazio na importação continua falhando, divergência documentada do canônico 9/10. Corrigir fallback nome, unificar enums de status e mudar quotas seria outra regra de negócio; não foi misturado aqui.
- Não executados: login browser autenticado, gesto DnD em browser, persistência em banco de teste, concorrência/carga, iframe/Atendimento, envio/recebimento provider ou webhook real. Testes de contrato dos handlers e preservação de fonte não substituem homologação operacional com esses ambientes. Não declarar ausência global de IDOR nem Bloco 2 integralmente homologado.

Para concluir Bloco 2: revisar cadastro isolado de tags e recursos compartilhados por contexto (Tasks/Agenda/OS/metas/relatórios/comentários/anexos), resolver achados anteriores de callbacks/admin/associações por evidência, planejar integração de Atendimento sem alterar identidade operacional ou lifecycle provider, e executar homologação independente autenticada. A pendência transversal de middleware no dev permanece fora do recorte; os três layouts agora protegem suas próprias páginas. Nenhuma alteração de CORE externo/provedor/schema foi necessária para este complemento; correções estruturais futuras continuam suspensas para proposta/aprovação própria.

Ativação futura exige inventário real expressamente autorizado, revisão dos snapshots/legados, política comercial/retensão definida, cobertura completa, testes operacionais e aprovação explícita rastreável por tenant. O manifesto permanece vazio; nenhum env/query/header/payload permite ativar enforcement. Bloco 3 não iniciado.

### Rastreabilidade e rollback da missão Vendas

Comparação a partir de `d9ac1fe1b8e8406489c2158e5c26186580544ef7`: https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/d9ac1fe1b8e8406489c2158e5c26186580544ef7...feature/modular-plans-entitlements . Commit final completo na entrega, sem auto-referência dentro do próprio commit.

Rollback: reverter somente o commit Vendas desta entrega com git revert, preservando d9ac1fe e todo o histórico anterior; sem reset/force push. A reversão remove layouts/imports/helper juntos e restaura seletores/validações anteriores. Ela também retira os filtros tenant adicionais e restaura a shell dev sem sessão em Leads/Kanban, portanto exige revisão de segurança antes de qualquer publicação. Marketing/Projects e docs/oficiais ficam preservados. Não existe rollback de banco/provider/migration porque nada disso foi executado.

Resultado do recorte: nove APIs/16 métodos e duas páginas de Vendas integrados ao motor central, isolamento/autenticação testados nos cenários declarados, observação comercial mantida. Aguardar auditoria independente; **sem declarar o Bloco 2 homologado integralmente**. Sem nova branch/PR, merge, deploy, produção, migração, provider, enforcement ou Bloco 3.
