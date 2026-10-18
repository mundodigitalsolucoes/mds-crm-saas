# Bloco 1 — Motor central de módulos e planos

> As seções A–F registram a entrega original. O complemento auditado em
> `89420b3f980db96ba13d6a900632ba4c7d21bad0` está registrado na seção G e
> substitui as ressalvas originais sobre validação das APIs e edição de features inválidas.

## A. Auditoria, plano e decisões

Branch obrigatória: `feature/modular-plans-entitlements`. Referência confirmada no remoto antes das alterações: `ca0db44ac988c34da8ee3ee5b7c2d16740fc2a1c`. O checkout inicial estava limpo, na branch local `work`; a branch exigida foi criada localmente a partir da branch remota existente, sem alterar `main`.

Foi lido `docs/MODULAR_PLANS_WHITE_LABEL_PILOT.md`. Os documentos abaixo **não foram encontrados** no checkout da branch nem nos arquivos disponibilizados em `/workspace/library-files`, `/workspace/shared` e `/workspace/scratch`. Nenhum conteúdo foi presumido:

- `00-README-OPERACIONAL`
- `01-DOCUMENTO-MESTRE-OFICIAL`
- `02-STATUS-ATUAL`
- `04-ARQUITETURA-OFICIAL`
- `05-REGRAS-DE-IMPLEMENTAÇÃO`
- `07-CORE-PROTEGIDO`
- `08-REGRA-DE-ISOLAMENTO-DE-PROVIDERS`
- `09-MAPA-DE-DEPENDENCIAS`
- `10-CHECKLIST-DE-VALIDACAO`
- `14-METODOLOGIA-OFICIAL-DE-DESENVOLVIMENTO`
- `17-MODELAGEM-PRISMA`

Não foram encontrados arquivos `AGENTS.md` no checkout. A auditoria precedeu o código; o plano foi catálogo → parser → resolvedor somente de leitura → contratos → testes/documentação. A ausência da documentação limita a homologação das regras internas; a implementação foi mantida fora de autenticação, providers, cobrança, sincronização e enforcement.

### Estado encontrado e fluxos auditados

| Arquivos/fluxos | Evidência e decisão |
| --- | --- |
| `prisma/schema.prisma` | `Plan.features` e `Organization.features` são `String`, com default `[]`. A organização referencia o plano pelo nome em uma string, sem relação Prisma. Os limites já são colunas escalares. Reutilizar essa representação; nenhuma tabela/migração necessária. |
| `src/app/admin/plans/page.tsx` | Listas comerciais locais misturavam módulos e capacidades. `JSON.parse` sem validação de tipo podia produzir objetos/números. O controle numérico de WhatsApp também adiciona/remove `whatsapp` no salvamento. Centralizar catálogo e parser, preservando esse controle existente. |
| `src/lib/validations/admin.ts`, APIs `admin/plans/route.ts` e `admin/plans/[id]/route.ts` | Features são aceitas como string, sem validação semântica JSON. PUT propaga limites/features às organizações somente com `propagateToOrgs`; alteração de nome sem propagação pode deixar organizações no nome antigo. Não alterar esses contratos neste bloco. |
| `src/lib/checkLimits.ts` | `syncPlanLimits` copia features e seis limites do plano para uma organização. Helpers atuais de limites/status retornam permitido em exceções. Não substituir nem conectar o motor a esses guards neste bloco. |
| APIs `admin/organizations/route.ts` e `admin/organizations/[id]/route.ts` | Criação/edição podem copiar o plano via `syncFromPlan`; existe opção de manter limites manuais. Preservar os fluxos. |
| `src/app/api/webhooks/asaas/route.ts` | Pagamento confirmado atualiza status/plano e chama `syncPlanLimits`. Não tocar na cobrança. |
| `src/app/api/auth/signup/route.ts` | Cria organização com plano/status, mas sem cópia explícita de features; pode permanecer no default vazio. Também dispara provisionamento Chatwoot. Não presumir que organização vazia é nova ou legada apenas pelo nome do plano. |
| `src/lib/checkPermission.ts`, `src/lib/permissions.ts`, `src/types/permissions.ts` | Permissões operacionais por usuário são distintas dos módulos comerciais. Owner é liberado após validação do usuário/tenant, sem consultar features. Não modificar esses arquivos nem conceder permissões pelo motor comercial. |
| `middleware.ts`, `src/lib/auth.ts` | Sessões/status de assinatura não são um guard de módulos. Mapas de rotas/permissões são incompletos para enforcement. Preservados. |
| Atendimento, integrações e providers | Não há consumidor operacional de `Organization.features` encontrado pela busca de `features`/`syncPlanLimits` em `src`, `prisma` e `scripts`. Existem consumidores dos limites escalares e do helper de WhatsApp; não foram modificados. |

Nenhum dado real foi consultado ou alterado para classificar tenants. A identificação de organizações legadas em produção exige inventário autorizado; a auditoria confirma possibilidades no código, não quantidades reais.

### Política de compatibilidade

- O resolvedor observa somente a cópia **da organização**, coerente com propagação opcional e customizações existentes. Não consulta `Plan.features` como fallback e não infere direitos pelo nome `enterprise`, `professional` ou `trial`.
- Uma lista válida concede somente identificadores explícitos, conhecidos e disponíveis da categoria solicitada. Identificador futuro pode estar listado, sem ser contratável/operacional.
- Campo vazio/ausente, formato inválido, identificadores desconhecidos, módulos indisponíveis ou ausência de módulos explícitos geram `needsMigrationReview` com motivos. Isso é triagem, não prova da idade do plano ou autorização para migrá-lo.
- JSON inválido ou tipos incorretos não produzem direitos. Valores desconhecidos nunca concedem acesso; duplicatas são normalizadas. Não há aliases inferidos nem conversão silenciosa de caixa.
- Todos os resultados de configuração são `observe_only`, com `enforcementEnabled: false`. Nenhuma rota, Sidebar ou operação consulta o resolvedor para bloquear acesso. O comportamento operacional legado permanece; o motor não transforma essa continuidade em autorização universal.
- `needsMigrationReview: false` não autoriza enforcement. Mesmo configurações explícitas precisam de inventário, homologação e migração aprovada antes do Bloco 2.

## B. Implementação

Arquivos criados:

- `src/lib/entitlements/catalog.ts`: catálogo único e tipos `FeatureId`, `CommercialModuleId`, `CapabilityId`, `ChannelId`, `AddonId`; seletores `isFeatureId`/`featuresOfKind`. Atendimento, Vendas e Marketing disponíveis; Financeiro e Agentes IA planejados. `ai_assistant` legado permanece capacidade, distinto de `agentes_ia`.
- `src/lib/entitlements/features.ts`: `parseCommercialFeatures(unknown)`, leitura segura do formato JSON string já persistido. Diagnósticos de formato, desconhecidos e duplicatas; entrada malformada é rejeitada integralmente.
- `src/lib/entitlements/resolver.ts`: resolvedor puro `resolveCommercialEntitlements`, adapter injetável `createEntitlementResolver`, contratos de snapshot/resultado. Consulta por tenant exato, sem cache compartilhado; falha/ausência/divergência de tenant retornam resultado discriminado sem direitos.
- `src/lib/entitlements/organization.ts`: `getOrganizationEntitlements`, adapter Prisma somente leitura, com `where: { id: organizationId }` e seleção de `id`, `plan`, `features`. Nenhuma escrita.
- `src/lib/entitlements/channels.ts`: `ChannelEntitlementContract`, schema e parser de contrato futuro versionado. Quantidades inteiras não negativas; zero é zero. Sem conexão, inbox, conta, credencial, provider ou soma de adicionais automática. Não persiste nem traduz `maxWhatsappInstances`.
- `tests/entitlements.test.ts`: testes unitários pelo runner nativo Node, usando `tsx` já existente; nenhuma nova dependência.
- Este relatório.

Arquivo modificado: `src/app/admin/plans/page.tsx`. A tela usa catálogo/parser centrais, distingue capacidades de módulos/add-ons, oculta módulos planejados das opções de contratação e preserva identificadores desconhecidos ao editar listas válidas. Impede abrir o editor de features malformadas para evitar substituição silenciosa por uma lista vazia. Não grava nada automaticamente nem muda os contratos de POST/PUT/propagação.

Sem alterações em schema, migrations, manifestos, lockfile, Sidebar, permissões, autenticação, sincronização, limites reais ou providers.

### Uso futuro no servidor

```ts
// O chamador precisa validar sessão, tenant ativo e assinatura separadamente.
const result = await getOrganizationEntitlements(trustedOrganizationId);
if (!result.ok) {
  // Falha explícita: não há entitlements nem fallback permissivo.
  return;
}
const vendas = result.entitlements.module('vendas');
// known / available / explicitlyListed / contracted são fatos comerciais.
// Não são permissão operacional do usuário nem autorização final de uma rota.
```

O resolvedor puro e o adapter não verificam usuário, plano ativo, soft-delete, retenção ou permissões. Esses checks continuam no CORE atual e serão compostos explicitamente no Bloco 2, nunca substituídos por `contracted` isoladamente.

## C. Validação

Ambiente: Node 24.19.0, npm 11.9.0, Next 16.2.6 resolvido pelo lockfile, Prisma 5.22.0. Nenhuma suíte de testes existente ou script `test` foi encontrado antes da implementação.

Comandos executados:

```bash
npm ci --cache /workspace/.npm --no-audit --no-fund
node --import tsx --test tests/entitlements.test.ts
npx --no-install tsc --noEmit --incremental false
npm run build
npm run lint
git diff --check
```

`npm ci` concluiu, incluindo geração Prisma, após o acesso de rede tornar-se disponível. Verificação TLS/checksums mantida.

Os 14 testes passaram, sem falhas, skips ou zero-test run. Cobrem os 12 cenários obrigatórios, incluindo módulos independentes, ausência de Marketing, capacidade White Label, vazios/legados, JSON inválido, desconhecidos/duplicatas/tipos inesperados, módulos futuros indisponíveis, tenants concorrentes, snapshot atualizado sem cache, falha de leitura e contrato de canais sem provider.

TypeScript passou. O primeiro build executado antes da integração final da tela passou. Um build posterior falhou por HTTP 503 transitório em fonte Inter de `fonts.gstatic.com`; a mesma URL voltou a responder HTTP 200 antes da repetição. **O build final com todas as alterações passou (exit 0)**, incluindo compilação, TypeScript e geração das páginas. Os avisos preexistentes sobre `images.domains` e a convenção `middleware` não foram tratados neste bloco. A alteração automática gerada em `next-env.d.ts` foi descartada; esse arquivo não integra a entrega.

Lint falhou por defeito preexistente: `next lint` foi removido no Next 16 e o comando trata `lint` como diretório. Não foi alterado para ampliar o escopo.

Não foram executados testes E2E com sessões reais do Super Admin, banco de produção, organizações reais, cobrança, Chatwoot, Meta, Evolution ou demais serviços externos. Testes de isolamento usam adapters em memória. Não houve migração local ou de produção nesta missão.

## D. GitHub

Entrega exclusivamente na branch `feature/modular-plans-entitlements`; não criar PR automaticamente. SHA completo e confirmação de push ficam na mensagem de entrega, pois um commit não pode conter seu próprio hash.

Comparação de toda a implementação contra a referência inicial:

https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/ca0db44ac988c34da8ee3ee5b7c2d16740fc2a1c...feature/modular-plans-entitlements

`main` remota foi conferida em `47bbccc7af03c8b665e3445f77066ae00e7018a0` antes da entrega. Nenhum checkout, commit ou push em `main` foi realizado.

## E. Segurança e rollback

Riscos residuais: ausência dos documentos oficiais listados; inventário real de features legadas ainda não realizado; payload string malformado ainda pode entrar pelas APIs atuais; guards existentes permitem acesso em algumas falhas; sem enforcement comercial novo para impedir bypass. O contrato de canais não é limite operacional nem formato persistido neste bloco.

Rollback: reverter o commit deste Bloco 1 na branch de trabalho com `git revert <SHA-da-entrega>`, preservando a especificação inicial. A tela volta às listas anteriores e os arquivos do motor/testes são removidos. Não há rollback de banco, provider ou dados. Não usar reset/force-push para apagar trabalho posterior. Revisão/merge/deploy de qualquer reversão dependem de autorização própria.

Nenhuma organização existente foi modificada. Nenhum provider, webhook ou fluxo de criação/sincronização foi alterado. Sem merge, deploy, mudança no Coolify ou migração em produção.

## F. Interfaces e pendências do Bloco 2

Disponíveis: catálogo, parser, snapshot comercial por organização, decisão `module(id)`, listas por categoria, diagnósticos de compatibilidade, resultado explícito de erro de leitura e contrato futuro de canais.

Antes de enforcement: fornecer documentos oficiais ausentes; inventariar/migrar features com autorização; definir marco explícito de ativação por organização; compor validação fresca de usuário/tenant/assinatura com permissões individuais; completar matriz de rotas/APIs e testes E2E. Limites por canal e lifecycle continuam reservados ao Bloco 3. Não derivar quantidade de conexões da mera presença de um canal/add-on.

O Bloco 2 não foi iniciado.

## G. Complemento do Bloco 1 — revisão independente

### Auditoria e decisões

Base remota confirmada: `89420b3f980db96ba13d6a900632ba4c7d21bad0`. A branch existente foi sincronizada por fast-forward, preservando o ADR acrescentado após a entrega original. Foram lidos a especificação, este relatório e `ADR-001-MODULAR-PLANS-GOVERNANCE.md` antes das alterações. Os 11 documentos adicionais continuam ausentes nos diretórios disponibilizados; seu conteúdo não foi presumido.

O único consumidor encontrado das APIs `/api/admin/plans` e `/api/admin/plans/[id]` é `src/app/admin/plans/page.tsx`: lista com `_count.organizations`, salva o modal com payload completo, alterna status com PUT parcial e exclui com DELETE. POST/PUT já usam schemas compartilhados de `validations/admin.ts`. O default servidor de `propagateToOrgs` era false, mas os três estados de abertura do editor eram true, sem confirmação. O editor também bloqueava toda edição de plano malformado, inclusive preço/descrição.

Decisões do complemento:

1. **Validação em duas etapas.** O schema compartilhado rejeita formato malformado antes de escrever. POST permite identificadores conhecidos/disponíveis e mantém `[]` como default. PUT valida as features somente quando enviadas ou quando o snapshot será propagado; compara novos identificadores com a lista anterior válida usando o catálogo/parser existentes.
2. **Compatibilidade sem descarte.** Desconhecidos e identificadores planejados previamente listados podem permanecer em um PUT, sem conceder direitos. Novos desconhecidos/indisponíveis são rejeitados. A string enviada é persistida sem reserialização, filtro ou normalização destrutiva; duplicatas continuam normalizadas apenas na leitura do motor. Enviar uma nova lista completa pode remover explicitamente um identificador antigo; o servidor não o reinsere.
3. **Edição parcial independente.** Omitir features permite atualizar preço, descrição ou status mesmo com JSON antigo inválido. Enviar novamente JSON inválido retorna 400. Propagar uma configuração inválida é rejeitado antes de atualizar plano ou organizações; é possível corrigir explicitamente as features e propagar a lista corrigida na mesma chamada.
4. **Propagação opt-in.** Formulários novos/reabertos começam com false. O checkbox informa estimativa carregada na listagem. Salvar com opt-in exige confirmação contendo nome, número estimado, substituição de features/limites e aviso de que a contagem pode mudar. Cancelar não envia requisição. O servidor continua exigindo booleano explícito true, nunca string truthy.
5. **Legado malformado no editor.** O modal permite campos administrativos e mostra aviso; controles de canais/features e propagação ficam desabilitados. No envio, omite features e `maxWhatsappInstances`, preservando dados antigos e forçando propagação false. A correção semântica do JSON pode ser feita por PUT explícito autorizado após revisão; não há ferramenta de reparo automático neste complemento.
6. **Autoridade comercial.** Os quatro handlers GET/POST/PUT/DELETE verificam `role === 'superadmin'` após o helper existente. Arquivos de autenticação/sessão e geração de tokens permanecem intactos. Token ausente ou papel distinto recebe 401 antes de acessar dados.

### Arquivos alterados e justificativa

| Arquivo | Alteração |
| --- | --- |
| `src/lib/validations/plan-features.ts` (novo) | Schemas semânticos reutilizam catálogo/parser; distinguem formato válido de novas features permitidas e preservação contextual de legados. |
| `src/lib/validations/admin.ts` | POST passa a validar novas features; PUT valida formato quando o campo é fornecido, sem exigir features em atualização parcial. |
| `src/app/api/admin/plans/route.ts` | Validação de criação pelo schema, HTTP 400 para JSON de requisição inválido e papel Super Admin explícito. GET mantém estimativa por nome de plano. |
| `src/app/api/admin/plans/[id]/route.ts` | Validação contextual antes de qualquer escrita, proteção de snapshots a propagar, JSON inválido 400 e papel Super Admin explícito. A seleção pelo nome antigo na propagação permanece. |
| `src/lib/plans/editor.ts` (novo) | Lógica real compartilhada pelo editor/testes: formulário com opt-in desligado, confirmação antes do request, preservação de legado e do limite escalar. |
| `src/app/admin/plans/page.tsx` | Usa o helper, mostra estimativa/aviso, permite edição administrativa de legados e distingue os rótulos administrativos -1/0. |
| `tests/admin-plans.test.ts` (novo) | Regressões dos handlers reais POST/PUT/GET/DELETE com autenticação e persistência simuladas, sem banco real. |
| `tests/plan-editor.test.ts` (novo) | Fluxos reais do helper usado pela tela: abertura/reabertura, cancelamento, confirmação, envio parcial e preservação. |
| `tests/legacy-whatsapp-limits.test.ts` (novo) | Coexistência dos contratos e caracterização do guard operacional atual sem alterá-lo. |
| `tests/helpers/load-server-module.ts` (novo) | Transpila e executa os fontes reais em VM com imports de infraestrutura substituídos. Usa TypeScript já instalado; não carrega Prisma/autenticação reais. |
| Este relatório e `docs/ADR-001-MODULAR-PLANS-GOVERNANCE.md` | Novas decisões, evidências, limites de compatibilidade, riscos e rollback. |

Nenhuma dependência adicionada, nenhuma alteração no parser/resolvedor original, schema Prisma, migration, autenticação, provider, conexão, inbox, webhook ou limite operacional.

### Limites: intenção administrativa versus comportamento atual

| Camada | `-1` | `0` | Inteiro positivo |
| --- | --- | --- | --- |
| Campo legado `maxWhatsappInstances` em schemas/editor | Aceito e preservado como ilimitado | Aceito e preservado; intenção administrativa: nenhum WhatsApp | Quantidade máxima |
| Guard operacional preexistente `checkLimits.ts` e listagem Evolution | Ilimitado | **Também interpretado como ilimitado**, por `<= 0` | Compara uso com máximo |
| Contrato futuro `maxConnections` | Rejeitado | Zero conexões | Quantidade máxima |

Essa divergência de zero foi confirmada no código e por teste do guard atual com adapter em memória. O cartão de planos passa a exibir a intenção administrativa (`0 = Sem WhatsApp`), **sem afirmar que o CORE já bloqueia zero**. Não houve conversão de -1 para zero, aplicação do schema futuro ao legado ou alteração operacional. A semântica real de zero e a representação futura de ilimitado precisam de decisão/migração própria antes do Bloco 3; este complemento não resolve esse risco.

### Validação do complemento

```bash
node --import tsx --test tests/*.test.ts
npx --no-install tsc --noEmit --incremental false
npm run build
npm run lint
git diff --check
```

Resultado final: 51 testes aprovados (14 originais, 26 de API, 8 de editor, 3 de limites), nenhuma falha/skip; TypeScript e build aprovados. O build gerou alteração local em `next-env.d.ts`, descartada por ser saída automática fora do escopo. Os testes de API executam os handlers reais com dependências simuladas, inclusive a comparação contextual do PUT. Nenhuma requisição de mutação foi enviada a servidor real e nenhum plano/tenant foi modificado no banco.

Lint continua falhando com exit 1: `next lint` não existe no Next 16. **Proposta isolada, não aplicada:** substituir o script por `eslint .` e adicionar `eslint.config.mjs` em formato flat usando `eslint-config-next/core-web-vitals` e `eslint-config-next/typescript`, com ignores de `.next`, `out`, `build` e `next-env.d.ts`. É preciso levantar a baseline das regras e migrar exceções em tarefa de tooling separada; apenas trocar o comando, sem configuração, não resolve. Não foram desativadas regras para produzir aprovação artificial.

Revisão independente do diff backend não identificou regressão concreta de severidade P0/P1/P2. Sem testes browser E2E ou teste de carga/concorrência/banco real. A confirmação foi testada no helper efetivamente usado pela UI, com ordem `confirm` → `request` e zero requests em cancelamento.

### Riscos, rollback e próximos passos

- A estimativa usa a última contagem da listagem, não é bloqueio transacional nem garantia de quantidade exata. Outro cliente autenticado continua podendo fazer PUT explicitamente propagante; a confirmação é a proteção da UI, não um novo protocolo de autorização.
- Atualização do plano e `organization.updateMany` continuam não transacionais (preexistente). Uma falha da segunda operação pode deixar propagação incompleta; nenhuma transação, migração ou reparo de dados reais foi executado.
- Renomear sem propagar deixa organizações no nome anterior (preexistente). O sistema usa string de nome, não uma FK; requer revisão antes de renomear planos em uso.
- A propagação existente copia features, usuários, leads, projetos, OS e WhatsApps; não foi ampliada para `maxGoals` ou outros campos. O fluxo separado `syncPlanLimits` permanece intacto.
- Features antigas inválidas continuam armazenadas quando omitidas. A migração/inventário autorizado continua necessário; o complemento impede novos payloads malformados e cópia massiva deles, sem habilitar enforcement.
- Identificadores legados aceitos na gravação continuam sem direitos quando desconhecidos/planejados; `observe_only` permanece obrigatório. A implementação dos módulos futuros não foi antecipada.

Rollback: `git revert <SHA-do-complemento>` em branch de trabalho, sem reset/force-push. Restaura schemas/handlers/editor anteriores e remove apenas os helpers/testes do complemento; mantém o motor original e o ADR original. Nenhuma reversão de schema, banco ou provider é necessária. Esse revert restaura também os defaults antigos de propagação e a ausência da validação backend, portanto precisa de revisão antes de qualquer publicação.

Commit final e comparação imutável ficam na entrega. Comparação do complemento: https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/89420b3f980db96ba13d6a900632ba4c7d21bad0...feature/modular-plans-entitlements

`main` não foi alterada; nenhuma branch ou PR novo, merge commit, deploy, escrita em produção ou alteração no Coolify foi realizada. O complemento encerra aqui para homologação independente. Pendências do Bloco 2 continuam as da seção F e do ADR: documentos canônicos, inventário aprovado, marco de enforcement, composição de autorização e matriz de APIs/rotas. **Bloco 2 não iniciado.**
