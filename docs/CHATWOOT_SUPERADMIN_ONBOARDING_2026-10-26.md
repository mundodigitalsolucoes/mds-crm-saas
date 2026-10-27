# Chatwoot — onboarding automático pelo Super Admin

Base local/remota confirmada antes da implementação: `77f4eeb79427a1b949b8192b64dec50557a5402d`, `audit/block2-sanitized`, PR existente #15 Draft. Nenhum commit posterior estava no remoto. Somente desenvolvimento/testes locais; sem push, merge, deploy, DNS, configuração da VPS ou recursos reais Chatwoot.

## Auditoria, evidência e causa

Documentos consultados: Documento Mestre, Arquitetura, Core Protegido, Isolamento de Providers, Metodologia, Modelagem Prisma e Checklist de Validação em `docs/oficiais/`. Esse diretório é um pacote histórico com inventário/hash imutável; o manual de trabalho novo fica em `docs/MANUAL-OFICIAL-ONBOARDING-WHITELABEL-DOMINIO_2026-10-26.md`, sem alterar o arquivo recebido.

Arquivos auditados: os dois provisionadores, signup, criação/listagem administrativa, recuperação administrativa, credenciais operacionais, helper Chatwoot, validações administrativas, editor de organizações, Organization/User/ConnectedAccount e regressões de autenticação/SSO.

| Fluxo antes | Evidência |
| --- | --- |
| Signup público | Cria organização + owner em transação; chama `provisionChatwootForOrg` de `chatwoot-provision.ts` |
| Super Admin | Cria apenas Organization, sincroniza plano e retorna; não cria owner nem chama provisionador |
| Recuperação antiga | Escolhe primeiro owner, gera senha temporária e permite force sobrescrever integração |
| Provisionador oficial anterior | Platform API; persiste vínculo só depois das criações; pode criar nova account se vínculo inconsistente e ignora falha de membership |
| Provisionador Rails | `chatwootOnboarding.ts` não tem chamadas ativas; usa Docker/Rails e não será adotado |
| Sessão operacional | Consome Organization + ConnectedAccount + User; não cria conta Chatwoot por existir instância Evolution conectada |

A diferença explica a lacuna na origem: organização/usuário/canal não equivalem a conta Chatwoot configurada. A inspeção de estado real da Ótica não foi refeita nem a ausência externa declarada como comprovada por esta implementação.

Trechos reais anteriores:

```ts
// Signup
provisionChatwootForOrg({ organizationId: result.organization.id, /* owner... */ })
// Super Admin: fluxo encerrava após create/sync, sem provisionamento
const org = await prisma.organization.create({ data: { /* nome, slug, plano, limites */ } });
```

Solução entregue nos arquivos completos versionados: criação CRM/owner atômica → plano existente → mesmo provisionador oficial com checkpoints → DTO público de progresso/recuperação. Nenhuma engine ou provider paralelo.

## Plano, impacto e fronteiras

1. Consolidar segurança de idempotência **no provisionador existente**, sem tocar motor operacional.
2. Integrar criação e recuperação Super Admin a ele, usando verificador administrativo e validações existentes.
3. Acrescentar owner e quadro de progresso ao modal existente, preservando edição/branding/domínio.
4. Testar provider sintético + PostgreSQL/NextAuth e ampliar o workflow existente somente para esse teste.
5. Documentar rollout, recuperação nominal e rollback; não executar produção ou publicar nesta missão.

Risco principal: efeitos remotos não são atomicamente confirmados pelo PostgreSQL. A solução persiste intenção antes do POST, IDs/credenciais depois da resposta e interrompe quando não consegue reconciliar. Não promete exactly-once externo sem suporte do provider nem apaga recursos para esconder a falha.

## Implementação e contratos

### Criação administrativa

- Schema local estende `adminOrgCreateSchema` com owner a partir de `adminUserCreateSchema.pick`; schemas globais/exports não foram duplicados nem modificados.
- A UI exige proprietário; o contrato antigo sem owner é preservado para compatibilidade, retornando pendente/awaiting_owner e sem criação externa.
- Slug/email duplicados, inclusive identidades inativas, não são reaproveitados. Owner/org são atômicos e a senha CRM só é hash; resposta contém apenas ID/nome/email do owner.
- O plano selecionado precisa existir para sincronização; usa `syncPlanLimits`, sem motor comercial novo. Uma falha posterior não apaga organização/usuário já criados nem declara Atendimento pronto.
- Resposta 201 pode indicar Chatwoot pendente; observar `onboarding.success`, `provisioned`, `error`, etapa e mensagem. Não repetir criação por perda de resposta sem conferir slug/lista.

### Provisionador oficial

- `ConnectedAccount(provider, organizationId)` existente é a reserva durável exclusiva, inicialmente inativa. Sem migration ou dependência adicional.
- Valida owner ativo único, organização ativa, URL e identificadores conhecidos antes de recurso externo. IDs conflitantes/legados inconsistentes resultam em revisão, não criação.
- Cada checkpoint usa CAS sobre dado/token/updatedAt, valida membership CRM e mantém lease por execução. Requisições concorrentes não criam recursos extras. Em crash, lease expira em 120 segundos; resultado remoto ambíguo não libera uma nova criação por simples decurso do tempo.
- Account recebe marcador de organização e operação; uma resposta perdida é reconciliada via listagem/show antes de continuar. Marcadores duplicados ou divergentes interrompem o processo mesmo com ID local conhecido.
- Usuário recebe `crmUserId`, `organizationId` e operação. O upstream pode reutilizar email; response/ID/atributos/memberships são validados antes de guardar token ou anexar. O CRM não envia PATCH de nome/senha nem associa uma identidade estrangeira à nova conta. O POST de users do próprio Chatwoot é um upsert privilegiado e pode confirmar o usuário/conceder permissão ao Platform App antes de responder; esses efeitos internos não podem ser desfeitos com segurança por este cliente. A validação bloqueia a associação e a persistência de tokens de terceiros; emails já existentes no Chatwoot exigem inspeção prévia e procedimento específico.
- IDs/account/token são salvos por etapa; membership e webhook são retomados a partir de leituras. Falha no commit final reverte Organization/User/isActive, preservando o checkpoint/recursos externos para nova tentativa.
- Somente após conferir perfil, membership administrativa, confirmação de identidade, endpoint SSO e registro do webhook a transação final marca ready e vincula owner/organização/CA.
- Integração ativa válida é reutilizada sem modificar dados, token ou updatedAt. Force foi removido como modo de sobrescrita.
- Criptografia usa `TOKENS_SECRET` existente. Senha Chatwoot independente é gerada pelo servidor; senha CRM nunca é transmitida ao Chatwoot. Credenciais não vão a responses administrativas, artefatos ou logs.
- Logs do registro de webhook preservam apenas status HTTP, sem texto remoto que possa refletir tokens. Payload/URL/subscriptions e comportamento operacional do registro permaneceram iguais.

### Recuperação, signup e limites

- Rota administrativa existente continua usando `verifyAdminToken`. GET retorna DTO local sem `data`/tokens; POST rejeita force e exige inspeção confirmada para organização antiga sem checkpoint.
- Retomada conhecida não precisa da senha CRM nem altera autenticação/credenciais de outros providers.
- Signup continua transacional e assíncrono no mesmo provisionador; apenas sinaliza que a organização acabou de ser criada. Não muda consentimento, sessão ou regras de identidade.
- O Rails runner legado permanece inalterado e sem chamadas; não é fallback.
- Iframe/credentials operacional, core Chatwoot, webhooks operacionais, Evolution/Cloud/Instagram/e-mail/widget, módulos, permissões, domínio V1.1 e schema Prisma permanecem sem mudanças.

## Matriz de validação

| Critério | Prova isolada |
| --- | --- |
| Organização + owner + Chatwoot | POST administrativo real/NextAuth + PostgreSQL + provider HTTP sintético |
| Sucesso de provisionamento | IDs de org/CA/User, membership, webhook e SSO consistentes |
| Chatwoot indisponível | CRM/owner preservados; integração inativa; recuperação possível |
| Falha parcial | Membership/webhook e erro de auditoria final com rollback de flags |
| Resposta perdida | Conta reconciliada pelo marcador; nenhum segundo POST account |
| Concorrência/reexecução | Uma conta; integração ativa não é sobrescrita |
| Vínculo ambíguo | Nome legado sem marcador, marcador duplicado, IDs locais conflitantes, identidade remota estrangeira: revisão, sem mais writes |
| Ausência de configuração | Retorno sanitizado antes de rede/recursos externos |
| Dois tenants | Contas/users distintos, inclusive mesmo nome; NextAuth/SSO sem acesso cruzado |
| Evolution/WhatsApp | Snapshots de CA Evolution e instância conectada iguais após provisionamento |
| Signup | Cadastro público por HTTP chama o mesmo serviço e conclui vínculo |
| Sessão de Atendimento | Endpoint credentials protegido real, ssoMode=user e IDs próprios por sessão |
| Contrato/branding/domínio | Features/settings/estado ativo V1.1 preservados; regressões C0–C5/branding/domínio |
| Autorização | Anônimo e cliente negados antes de efeitos; shared Super Admin; force rejeitado |
| Integridade de fonte | Todos os providers protegidos continuam pinados; exceção só ao provisionador oficial + logs sem corpos externos |

**Resultados locais finais:** 642/642 testes Node/TypeScript/PostgreSQL (14 cenários funcionais novos de provisionamento); 9 cenários HTTP de onboarding com NextAuth/credenciais reais e provider sintético; 52 cenários HTTP de domínio próprio com reinício real; 10/10 probes C0–C5; `npm run build -- --webpack`, typecheck, `prisma validate`, lint dos arquivos alterados e diff check aprovados.

Resultados finais e hashes de arquivos em `docs/evidence/CHATWOOT_SUPERADMIN_ONBOARDING_2026-10-26.json`. Logs privados locais fora do Git em `mds-crm-onboarding-evidence/chatwoot-onboarding-2026-10-26/`.

## CI

Workflow existente PostgreSQL recebe a prova HTTP de onboarding com provider sintético e artefato apenas de resultados, mantendo `contents: read`. Node inclui automaticamente a suíte nova. Execução HTTP exige `CI=true`, opt-in descartável, DB loopback específico e checkout sem .env reais; o processo Next recebe allowlist de ambiente e somente credenciais sintéticas geradas em memória.

Não há comando de deploy ou segredo GitHub/provider real. CI remota para o novo SHA depende de publicação autorizada; os resultados da base 77f4eeb não substituem os novos testes locais.

## Pendências reais e recuperação do piloto

- Confirmar versão/permissões/serialização da Platform API real e disponibilidade das variáveis já existentes. Nenhuma delas foi alterada aqui.
- Fazer inspeção read-only da Ótica e dos possíveis recursos Chatwoot globais, não apenas da lista visível ao Platform App. Preservar organização/owner/domínio/instância existentes.
- CA ativo/inativo desconhecido, user remoto sem marcadores ou IDs divergentes exigem reconciliação nominal/autorização própria. O patch não oferece um botão force/adotar IDs não verificados.
- Validar a titularidade do email e inspecionar conflitos externos conhecidos antes da recuperação; a unicidade no CRM não prova ausência global no Chatwoot. O upsert do provider pode confirmar identidade/permissão do aplicativo, mesmo que o CRM rejeite o vínculo; esse efeito exige avaliação no rollout, não é ocultado por um teste de usuário já confirmado.
- Uma identidade estrangeira descoberta após o POST de users pode deixar uma conta vazia **conhecida no checkpoint**, sem owner anexado. Não apagar nem recriar: revisar. A resposta perdida de user também exige revisão em vez de replay.
- Sessão via API foi testada, mas browser/iframe, certificado/cookies/CSP e mensagens reais na instalação precisam de homologação autorizada. Atendimento configurado não equivale a canal homologado.
- Recuperar o piloto somente após rollout autorizado e inspeção; usar o mesmo endpoint/service, nunca Rails/Docker ou recriação da organização. Procedimento completo no Manual Oficial novo.

## Coolify e rollback

Mesmo recurso CRM, Dockerfile/startup, banco, tokens, volumes e providers. Sem migration e sem variável nova. Publicação e build Docker precisam de autorização/verificação de rede; o bloqueio conhecido de índices Alpine é separado do build Next. Preservar imagem/SHA estável e backup de metadados/credenciais/checkpoints sem exibi-los.

Durante rollback, pausar onboarding/recuperação para não reexecutar o serviço antigo em checkpoints pendentes: ele não os reconhece e pode duplicar recursos. Não remover CA/checkpoints, não restaurar settings de providers ou VPS inteira e não apagar recursos remotos. O core/SSO existente e credenciais de integrações prontas continuam no formato anterior. Preferir correção controlada/rollforward se houver operações pendentes.

Nenhum gate G1–G6 ou piloto é aprovado automaticamente. Nenhuma criação real de conta da Ótica foi realizada.

## Arquivos completos alterados

- `src/lib/integrations/chatwoot-provision.ts`: provisionador oficial e DTO sanitizado, sem corpo externo nos logs.
- `src/app/api/admin/organizations/route.ts`: owner/organização e integração ao serviço.
- `src/app/api/admin/orgs/[orgId]/provision-chatwoot/route.ts`: inspeção/recuperação segura e resultado negativo nunca ecoa ready local.
- `src/app/api/auth/signup/route.ts`: somente sinal de criação nova para o mesmo provisionador.
- `src/app/admin/organizations/page.tsx` e `src/components/OrganizationChatwootOnboarding.tsx`: proprietário/progresso/recuperação no modal atual, sem reformulação do CRM.
- `tests/chatwoot-onboarding-postgres.test.mjs`, `tests/chatwoot-onboarding-http.mjs`, `tests/helpers/synthetic-chatwoot.mjs`: provas funcionais/sintéticas e de autorização.
- `tests/authorization-boundaries.test.ts`: exceção exata ao provisionador autorizado, mantendo pin de todos os demais providers e contrato do registro de webhook.
- `.github/workflows/block2-postgres-concurrency.yml`: execução e artefato do novo probe HTTP.
- Este relatório, `MANUAL-OFICIAL-ONBOARDING-WHITELABEL-DOMINIO_2026-10-26.md` e JSON de evidências.
