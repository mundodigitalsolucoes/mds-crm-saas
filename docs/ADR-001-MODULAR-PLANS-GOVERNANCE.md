# ADR-001 — Planos modulares, compatibilidade e governança de alterações

**Data:** 2026-10-18  
**Estado:** decisões registradas; documentação oficial incorporada e rastreável; Bloco 2 parcial em observação, com correção pontual de sessão em Projetos, sem homologação ou ativação ampla.

**Base auditada:** Bloco 1 em `175dcb8efd3256637c3f32d00580bb7118300b3c`; complemento a partir de `89420b3f980db96ba13d6a900632ba4c7d21bad0`.

**Escopo:** MDS CRM SaaS multi-tenant; piloto White-Label Ótica São Paulo.

## 1. Decisões oficiais
- CORE compartilhado e único, sem fork por organização.
- Super Admin MDS é a autoridade comercial para planos, módulos, capacidades, limites e identidade White-Label.
- Módulos independentes: `atendimento`, `vendas`, `marketing`; `financeiro` e `agentes_ia` planejados, não operacionais.
- `white_label`, `advanced_reports`, `integrations`, `ai_assistant` são capacidades; não se confundem com módulos. `ai_assistant` legado não é `agentes_ia`.
- Canais e add-ons são dimensões próprias. O direito comercial não substitui permissão operacional por usuário.
- Atendimento tem canais habilitados e limites individuais por tipo de canal, a implementar no Bloco 3.
- Dashboard e configurações comuns são infraestrutura da plataforma e devem respeitar os módulos contratados.
- Cliente owner/admin gerencia operação e membros, nunca planos, limites comerciais ou branding MDS.
- Ótica São Paulo: piloto com Atendimento + Vendas + White-Label; Marketing desativado após enforcement homologado. Quantidades de canais/usuários ainda não definidas.

## 2. Fonte de verdade e compatibilidade
- Persistência atual: `Plan.features` e `Organization.features` como strings JSON; `syncPlanLimits` replica features/limites conforme fluxos atuais.
- Para o motor de leitura, `Organization.features` é o snapshot comercial da organização. Não inferir direitos pelo nome do plano ou por fallback automático de `Plan.features`.
- Parser: somente array JSON de strings; identificadores desconhecidos não concedem direitos; duplicatas normalizadas; configuração inválida não concede direitos novos.
- `observe_only` é obrigatório no Bloco 1. Não ligar guardas globais, alterar assinatura, migrar organizações ou bloquear módulos até inventário e homologação.
- `needsMigrationReview` é diagnóstico, não autorização de acesso nem prova de que a organização é legada.
- Sem inventário autorizado de dados reais, não se conhece o volume de organizações com `features=[]`, JSON inválido ou divergência entre plano e organização.
- Desativar módulo não significa apagar dados. Política de acesso e retenção será definida antes de enforcement.

## 3. Contratos de canais e providers
- O contrato futuro `ChannelEntitlementContract` usa quantidades inteiras >= 0; zero significa nenhuma conexão.
- O campo legado `maxWhatsappInstances` aceita -1 = ilimitado, 0 = nenhum, >0 = quantidade. **Não converter -1 em 0 nem aplicar diretamente o schema futuro.**
- Essa é a intenção administrativa. A auditoria complementar confirmou divergência preexistente: `checkLimits.ts` e a listagem Evolution usam `<= 0` como ilimitado, inclusive zero. O complemento documenta/testa essa realidade sem alterar guards/providers. Não assumir que zero bloqueia conexões no CORE atual.
- Uma futura migração deve definir explicitamente representação de ilimitado, conversão de valores legados e limites por canal, com testes e rollback.
- `whatsapp` como feature comercial não identifica provider nem representa uma conexão real.
- Regra operacional oficial: **1 número = 1 inbox = 1 canal operacional**. Evolution API e Meta Cloud API mantêm autenticação, webhooks, lifecycle, sessão, fila, onboarding e dispatcher isolados.
- Não modificar Chatwoot/Atendimento nem provisionamento no Bloco 1.

## 4. Pendências da auditoria independente e situação após o complemento
**P1 — validação no backend, corrigida no complemento:** POST/PUT reutilizam parser/catálogo em `validations/plan-features.ts`. Formatos inválidos retornam 400; novos identificadores desconhecidos/indisponíveis são rejeitados. PUT contextual preserva identificadores legados válidos, inclusive planejados previamente listados, sem direitos operacionais e sem reserializar a string enviada. Omitir features permite edição parcial de preço/descrição/status mesmo com dados antigos inválidos. Uma lista substituta explícita pode remover identificadores; eles não são descartados silenciosamente pelo servidor.

**P1 — propagação em massa, corrigida no complemento:** editor usa **false** em toda abertura; opt-in exige confirmação com nome, estimativa da última contagem e aviso de substituição de features/limites. Cancelar não envia request. O servidor mantém booleano explícito e papel Super Admin; valida o snapshot efetivo antes de qualquer escrita, impedindo propagação de features malformadas. A validação aceita reparo explícito seguido de propagação na mesma chamada. Nenhuma alteração de dados reais foi executada. A contagem continua estimada e plano/updateMany não são transacionais.

**P1 — limites de WhatsApp, documentados/testados no complemento:** -1/0/positivo são preservados pelo schema/editor legado; schema futuro continua rejeitando negativos. Testes caracterizam também a divergência operacional de zero acima. Sem migração, conversão ou enforcement no Bloco 1.

**P2 — lint, pendente em tarefa isolada:** confirmada falha exit 1 de `next lint` no Next 16. Propor `eslint .` com flat config `eslint.config.mjs`, presets Next core-web-vitals/TypeScript e ignores de saídas geradas; levantar baseline antes de corrigir regras. Nenhum ajuste de tooling foi misturado ao complemento.

**P1 — documentação, indisponibilidade resolvida nesta continuidade:** os documentos anteriormente ausentes foram recebidos no pacote de 12 canônicos, lidos integralmente e preservados em `docs/oficiais/`, com índice e origem/hashes. Este ADR é registro de decisões, não substitui os documentos originais. Disponibilidade não substitui plano de impacto, rollback e validação operacional antes de alterar CORE protegido.

## 5. Plano de correção complementar (mesma branch)
1. Auditar consumidores e payloads reais das APIs de planos, inclusive edição parcial e preservação de features legadas.
2. Implementar validação semântica **no servidor** para features novas/alteradas, rejeitando formato inválido sem conceder acesso; testar POST/PUT e edição parcial.
3. Tornar propagação **opt-in**, com confirmação e indicação do número de organizações impactadas; sem alteração automática de tenants.
4. Documentar e testar ponte de compatibilidade de `maxWhatsappInstances`, sem tocar providers nem schema de produção.
5. Registrar casos de teste, riscos e rollback no relatório de complemento.
6. Executar testes, TypeScript, build e lint apropriado (registrar qualquer falha pré-existente).

## 6. Critérios de aprovação
- Compatibilidade legada preservada e alterações em massa nunca ocorrem por default.
- Nenhuma escrita em organização, banco de produção ou provider.
- Sem enforcement de módulos, merge, PR novo ou deploy.
- Evidência de testes para payloads inválidos, preservação de desconhecidos, atualização parcial e propagação opt-in.
- Revisão independente do novo SHA antes de iniciar Bloco 2.

## 7. Proteção do CORE e operação
A metodologia oficial exige **Auditoria → Plano → Implementação → Validação**. Não implementar por hipótese; mapear impacto e rollback. Atendimento iframe `src/app/(app)/atendimento/page.tsx`, providers, webhooks, pipeline e isolamento multi-tenant são protegidos. Deploy Coolify é **manual pelo responsável**, somente após aprovação expressa.

## 8. Rastreabilidade
- Especificação: `docs/MODULAR_PLANS_WHITE_LABEL_PILOT.md`.
- Relatório de implementação: `docs/MODULAR_PLANS_BLOCK1_REPORT.md`.
- Commit Bloco 1: `175dcb8efd3256637c3f32d00580bb7118300b3c`.
- Registro de pendências e decisões: este ADR.
- Próximo marco: homologação independente do SHA do complemento; Bloco 2 **não autorizado** até nova revisão.

## 9. Não decidido
- Limites concretos do piloto Ótica São Paulo.
- Migração das organizações legadas e marco de enforcement por organização.
- Representação persistida futura de canais e de quantidade ilimitada.
- Política de retenção/visibilidade de dados de módulos desativados.
- Matriz completa de rotas e APIs por módulo.

## 10. Evidência do complemento e limites de escopo

- 51 testes aprovados: 14 originais, 26 de handlers de API, 8 de editor e 3 de compatibilidade de limites. API/banco/autenticação simulados, sem operação de escrita real. TypeScript e build passaram; lint mantém falha preexistente documentada.
- O editor de legado malformado permite campos administrativos, desabilita features/canais/propagação e omite features/WhatsApps no payload. Não há correção automática nem descarte do JSON antigo.
- GET/POST/PUT/DELETE de planos exigem `role === 'superadmin'`; autenticação, sessão e tokens existentes não foram alterados.
- Riscos preexistentes preservados: rename sem propagação deixa organizações no nome antigo; propagação não transacional; semântica operacional `<= 0`; ausência de inventário e documentação canônica. Nenhum guard comercial novo foi ligado.
- Rollback: reverter o commit do complemento sem alterar dados, schema ou providers. O revert restaura os defaults/validação anteriores e exige revisão própria antes de publicação.
- Arquivos, comandos, resultados e comparações: seção G de `MODULAR_PLANS_BLOCK1_REPORT.md`. Nenhuma branch/PR novo, merge commit, deploy ou Bloco 2.

## 11. Preparação autorizada do Bloco 2

A missão posterior, baseada em `f93c3435fff316a548255993d749ef545c9c7670`, autoriza preparação do Bloco 2, sem enforcement ou Bloco 3. Os registros anteriores são históricos; esta autorização não libera merge/deploy.

- Nova camada reutiliza o resolvedor do Bloco 1 e defaults operacionais existentes, com identidade/vínculo/estado lidos no servidor. Owner/admin não ignoram entitlement na decisão teórica; Super Admin tem contrato administrativo separado e não impersona tenant.
- Modo efetivo depende de manifesto servidor revisado, que permanece vazio. Observe_only preserva a autorização legada e registra decisões negativas/erros, sem convertê-los em grants do motor novo. Enforce existe apenas preparado e testado por injeção.
- Integração inicial: APIs e renderização servidor de Marketing/Projetos, com tenant também nas mutações finais. Demais superfícies e exceções estão em `BLOCK2_ACCESS_MATRIX.md`.
- A ausência dos 12 documentos indicados na missão impede alterações seguras no CORE/providers e classificação definitiva de compartilhados; essas áreas ficam suspensas. Os achados concretos não são declarados resolvidos.
- Inventário real não executado; script read-only e fixtures entregues. Não há migração, correção ou propagação automática de organizações.
- Evidências, riscos, rollback, 87 testes aprovados e limites de homologação estão em `BLOCK2_AUTHORIZATION_REPORT.md`. Cobertura parcial não autoriza ativação ampla nem início do Bloco 3.

## 12. Documentação recebida e revisão pontual de Projetos

- Base da continuidade: `9e2a785a9cdbcf5502991e3d5853d29b8685e27a`. Leitura integral dos 12 documentos, índice e revisão de informação sensível concluídas; originais e índice preservados byte a byte em `docs/oficiais/`, com origem/hash em `ORIGEM.md`. Os registros anteriores de indisponibilidade são históricos.
- Os canônicos são snapshots de maio de 2026. Não foram reescritos para o estado da branch; status e decisões desta missão constam do suplemento no relatório. Exemplos de push main/deploy do documento 14 não autorizam essas ações nesta solicitação.
- Investigação isolada: dev entregava shell genérica/loading em `/projects` (200), sem dados de projetos identificados; API 401. Runtime local de build já redirecionava 307. Descoberta de middleware dev com src/app consulta src, enquanto o arquivo está na raiz. Isso não justifica mover middleware global sem plano transversal.
- Correção mínima: exigir sessão no guard da página antes da política de observe_only. Separação explícita: autenticação obrigatória não é enforcement comercial. Após correção, dev e runtime de build retornaram 307/login para Projetos, API 401 e login 200; manifesto de enforcement permanece vazio.
- Documentos confirmam Vendas/pipeline e MarketingProject; KanbanBoard de projeto não é a mesma superfície de `/kanban` comercial. Task/Agenda e demais compartilhados exigem regra contextual; não serão reclassificados por nome de permissão. Atendimento/providers mantêm contratos e fontes intactos.
- Referências adicionais do pacote (deploy/handoffs/changelog/backlog) não foram fornecidas nem inventadas. Nenhuma tensão de redação foi resolvida com alteração arquitetural; mudanças estruturais futuras exigem decisão específica.
- Evidências, 91 testes executados/aprovados, comandos Prisma/TypeScript/build, riscos e rollback estão na revisão final de `BLOCK2_AUTHORIZATION_REPORT.md`. O arquivo canônico `02-STATUS-ATUAL` não foi alterado silenciosamente; o status atual desta tarefa fica nesse suplemento.
- Bloco 2 permanece parcial; nenhuma migração, modificação de dados reais, lifecycle, enforcement, merge, deploy ou Bloco 3 autorizado.
