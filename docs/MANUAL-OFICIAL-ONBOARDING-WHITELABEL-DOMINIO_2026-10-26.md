# Manual oficial — onboarding SaaS, Atendimento, White-Label e domínio

Atualização: 26/10/2026. Este manual de trabalho fica fora de `docs/oficiais/`, que preserva byte a byte o pacote original recebido. Implementação local na candidata saneada; publicação/deploy/homologação real exigem autorização e resultados do SHA exato. Não descreve uma operação já executada na Ótica São Paulo.

**Organização criada ≠ Chatwoot provisionado ≠ WhatsApp conectado ≠ Atendimento homologado.**

## 1. Pré-requisitos MDS

- Usar o Super Admin MDS, com autenticação administrativa existente; owner/admin do cliente não administra o provisionamento de organizações.
- Plano comercial cadastrado com módulos/capacidades explícitos. Atendimento, Vendas e Marketing independentes; White-Label e `custom_domain` separados. Preservar `observe_only` e `APPROVED_ENFORCEMENTS=[]`.
- Servidor CRM com a URL Chatwoot já configurada (`CHATWOOT_API_URL`, ou fallback público existente), `CHATWOOT_PLATFORM_TOKEN`, `TOKENS_SECRET` válido, `CHATWOOT_WEBHOOK_SECRET` e origem canônica CRM. Não há variável nova obrigatória.
- O token precisa consultar/criar contas pela Platform API, criar usuário e associação, consultar perfil/login SSO; o token do usuário fica criptografado no CRM. Não usar senha de Super Admin Chatwoot, Docker exec ou Rails runner.
- Confirmar versão/permissões da Platform API instalada antes do rollout: a implementação exige listagem/show de accounts, `custom_attributes`, usuários/SSO e perfil com membership. Código público consultado documenta esses contratos; a instalação real não foi consultada/alterada neste trabalho. Endpoint ausente ou resposta desconhecida bloqueia a criação com erro sanitizado.

## 2. Criar pelo Super Admin

1. Abrir Organizações → Nova Organização.
2. Selecionar plano existente e informar nome/slug. IDs de organização são gerados no CRM, não fornecidos pelo cliente.
3. Confirmar a titularidade do email e revisar conflitos conhecidos no Chatwoot: unicidade no CRM não prova ausência no provider. Informar nome, email e senha inicial CRM do proprietário. Usar pelo menos 12 caracteres; não copiar para logs ou relatórios. Entrega dessa senha ao responsável é operação humana em canal aprovado, não um envio automático implementado aqui.
4. Confirmar criação. Organização + proprietário são atômicos; email/slug duplicados não reutilizam identidades nem criam organização órfã. Limites/features usam `syncPlanLimits` existente.
5. O backend chama `provisionChatwootForOrg` oficial via Platform API. A senha Chatwoot é independente, gerada pelo servidor e criptografada; não precisa ser a senha CRM. Não vai ao navegador.
6. Acompanhar o quadro do Atendimento no mesmo modal: aguardando proprietário/provisionamento, provisionando, configurado ou recuperação necessária. Se a resposta da criação se perder, conferir a lista/slug antes de repetir; não criar outro cliente para contornar o erro.
7. Configurado significa: conta isolada, usuário do owner identificado, membership administrativa, endpoint SSO válido e webhook de conta verificado. Não significa que inboxes, QR Code, mensagens ou iframe na VPS já foram homologados.

A API histórica continua permitindo criação sem `owner` para compatibilidade; responde `awaiting_owner`, não pronta para Atendimento. O formulário novo exige proprietário. Para um registro antigo sem owner, cadastrar o proprietário pelo fluxo existente de usuários MDS antes de recuperar. Não criar automaticamente um owner com email/senha fictícios.

## 3. Fluxo oficial e checkpoints

- Oficial: `src/lib/integrations/chatwoot-provision.ts`; chamado por signup, criação MDS e recuperação MDS.
- Legado inativo: `chatwootOnboarding.ts` (Docker/Rails). Não foi chamado, alterado ou combinado com a Platform API.
- Progresso na linha única `ConnectedAccount(provider='chatwoot', organizationId)`, inicialmente inativa. Sem tabela/migration nova, sem lock apenas em memória.
- Estados internos: preflight → account_creating → account_ready → user_creating → user_ready → membership → webhook → ready. Resultado público é DTO sanitizado; não retornar `data`, `accessTokenEnc`, senha, token Platform ou resposta bruta.
- Cada recurso externo usa correlação durável (`crmOrganizationId`, `crmProvisionOperationId`; usuário também `crmUserId`). Cada checkpoint tem CAS, dono da execução e lease de 120 segundos renovada por etapa. Em crash, aguardar expiração antes de nova tentativa. Em falha controlada, o lease é liberado, sem apagar IDs conhecidos.
- Resposta perdida ao criar conta: a retomada lista contas e procura marcador exato antes de qualquer criação. Sem resultado conclusivo, não repete POST de criação; exige revisão.
- Usuário remoto pode ser reutilizado pelo próprio Chatwoot por email. O CRM não aceita isso como prova: valida IDs/atributos/membership. Sem correspondência, o CRM não anexa nem envia atualização de nome/senha. O upsert do próprio Chatwoot pode confirmar usuário/permissão do Platform App antes da resposta; esse efeito interno não é revertido automaticamente. Um email externo já utilizado exige inspeção/procedimento específico, não tentativa forçada. Resposta perdida na criação do usuário exige revisão; não reexecutar por suposição.
- Falha de membership/webhook/commit final: retomar pelos IDs criptografados/persistidos, sem recriar conta ou usuário. Se a associação já foi efetivada, o perfil é lido antes de tentar novamente.
- `ready` é marcado em transação que vincula Organization, User e ConnectedAccount. Falha faz rollback das flags finais; recursos remotos e checkpoint continuam recuperáveis.
- Integração ativa consistente é validada/reutilizada sem substituição de credenciais. Integração legada inconsistente ou IDs conflitantes nunca são sobrescritos, mesmo por `force=true`.

## 4. Sessão, inbox e conexão dos canais

1. Entrar no CRM com o owner da organização correta. Verificar que o endpoint protegido `/api/integrations/chatwoot/credentials` resolve a mesma organização, account e user. URL SSO efêmera é destinada somente à sessão autorizada, não deve ser publicada.
2. Abrir o Atendimento no fluxo existente e confirmar o boot automático. `ATENDIMENTO_USER_SSO_ENABLED` preserva seu comportamento; o novo vínculo do owner preenche `chatwootUserId`/`isChatwootAgent`. Outros usuários continuam no fluxo operacional já existente, sem compartilhar identidade entre organizações.
3. Criar inboxes pelo fluxo existente de canais/Atendimento. Este bloco não cria inbox ou conversa automaticamente.
4. Conectar Evolution API pelo onboarding específico desse provider. Não mover instância existente, não compartilhar inbox com Cloud API e não misturar lifecycle/session/webhook.
5. Validar conexão/reconexão, envio e recebimento em arquivos/mensagens sintéticos autorizados. WhatsApp já conectado no CRM, isoladamente, não comprova boot do Chatwoot nem sincronização de inbox.
6. Homologar webhooks, atualização de Leads e pipeline sem duplicação, permissões owner/admin/comum e isolamento de duas organizações. Operação real depende de autorização posterior; os testes deste patch usam somente provider sintético.

## 5. Branding e domínio

Manter o editor e a governança MDS existentes. White-Label não concede módulos ou conecta canais. Domínio próprio depende da verificação DNS/TLS/proxy e ativação explícita já implementadas; a V1.1 ativa é persistente, sem intervenção diária. Provisionar Chatwoot não pode modificar `settings.customDomainV1`, hostname, logo, cores, contrato ou assinatura.

Referências: `CUSTOM_DOMAIN_UNIVERSAL_V1_1_2026-10-26.md`, `CUSTOM_DOMAIN_HTTPS_SESSION_FIX_2026-10-26.md`, `WHITE_LABEL_UNIVERSAL_V1_2026-10-25.md`.

## 6. Recuperação administrativa

Endpoint existente: `/api/admin/orgs/[orgId]/provision-chatwoot`.

1. GET: consultar status local, IDs, etapa, erro sanitizado e recuperação disponível. Esse GET não comprova ausência de órfãos no Chatwoot externo nem consulta conteúdos de conversas.
2. Antes de primeiro provisionamento de organização antiga, inspecionar somente leitura no CRM e no Chatwoot os vínculos possíveis. A lista da Platform API mostra apenas recursos visíveis ao aplicativo, não necessariamente todas as contas do servidor; confirmar também a visão Super Admin se a origem do estado for desconhecida.
3. Marcar a confirmação de inspeção somente após essa revisão. O POST permite `{force:false,inspectionAcknowledged:true}`; não há sobrescrita forçada. Com checkpoint reconhecido, a retomada segura pode usar `{force:false}`.
4. O serviço sempre faz preflight remoto, valida IDs e mantém contas de terceiros intocadas. Conta sem marcador com nome coincidente, marcador conflitante, usuário de outro tenant, múltiplos owners ou CA inativo desconhecido levam à revisão, não a uma nova conta.
5. Não apagar o CA/IDs/checkpoints para "tentar do zero". Não excluir recursos remotos. Adoção/correção de vínculos ambíguos requer procedimento específico após evidência e autorização; este patch não oferece um bypass de validação.
6. Não declarar pronto pelo HTTP isolado: criação CRM pode retornar 201 com Atendimento pendente; consultar `onboarding.provisioned`, `error` e status. Recuperação retorna 202 em execução concorrente e 409 em estado que exige revisão.

## 7. Ótica São Paulo — procedimento futuro, não executado

- Preservar a organização, owner, Plano Piloto, Atendimento + Vendas, White-Label, domínio ativo e instância WhatsApp de teste. Não recriar nada.
- Coletar IDs/metadados/quantidades, sem tokens, senhas, nomes de contatos ou mensagens: owner ativo único; CA Chatwoot ativo/inativo; IDs org/CA/user e consistência; fase/erro/lease; URL/base; configuração existente dos providers.
- Confirmar somente leitura os possíveis recursos externos (inclusive contas fora da visão do Platform App). Ausência na UI do cliente não comprova ausência global. Verificar perfil/membership quando IDs forem conhecidos, sem publicar o token usado na consulta.
- Se não houver vínculo/órfão conflitante, autorizar explicitamente a recuperação pelo botão MDS/POST com inspeção confirmada. O mesmo provisionador será utilizado. Se houver ambiguidade, interromper e preparar reconciliação nominal, sem force.
- Conferir conta única, owner correto e status configurado; login do owner e boot do Atendimento; só depois conferir inbox adequada à instância existente e mensagens autorizadas. Não conectar novamente outro número/inbox para mascarar uma associação pendente.
- Confirmar que hostname/branding e demais providers não mudaram. Registrar evidência por etapa, sem dizer que o piloto está aprovado automaticamente.

## 8. Publicação e rollback

Não houve push/deploy/migration nesta implementação. Publicação futura somente na candidata saneada/PR #15 Draft mediante autorização; verificar remoto, CI no SHA exato e gatilhos. No Coolify, usar o mesmo CRM/variáveis existentes, preservar imagem/SHA estável, backups e eventos em trânsito. Não mudar Chatwoot/Evolution/Traefik/DNS nem executar Rails runner.

Antes do rollout, validar permissões/versão da Platform API e chave de criptografia existentes. Nenhuma migration ou variável nova é necessária. Validar build Docker no ambiente com acesso aos índices Alpine; build Next local não certifica a imagem completa.

Rollback do aplicativo não deve apagar CA, checkpoints, IDs remotos ou credenciais. Pausar criação/recuperação durante reversão. O provisionador anterior não entende checkpoints e pode duplicar recursos ao ser chamado com integração pendente: não executá-lo sobre esses registros; preferir corrigir/republicar o fluxo seguro. Preservar Atendimento já configurado e providers, sem snapshot global da VPS. Remoções/adoções reais exigem autorização própria.

## 9. Checklist de entrega

- [ ] Organização e proprietário corretos; plano/módulos preservados.
- [ ] Uma conta Chatwoot, owner/membership corretos, token criptografado e sem conflitos.
- [ ] Sessão automática validada no ambiente real após autorização.
- [ ] Inboxes/canais provisionados separadamente, respeitando isolamento de providers.
- [ ] Mensagens/webhooks/Leads/Pipeline homologados com dados autorizados.
- [ ] Outra organização sem acesso cruzado; permissões administrativas negadas ao cliente.
- [ ] White-Label e domínio persistente preservados.
- [ ] Backup/rollback e checkpoints registrados; sem credenciais em relatórios.
- [ ] Aceites formais independentes; nenhum gate/piloto aprovado automaticamente.
