# Bloco 2 — autorização: auditoria, plano e execução

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
