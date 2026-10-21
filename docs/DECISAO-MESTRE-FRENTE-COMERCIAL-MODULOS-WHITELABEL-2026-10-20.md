# MDS CRM SaaS — Decisão-mestre: assinaturas modulares e White-Label

**Data:** 20/10/2026  
**Classificação:** decisão oficial de produto e escopo comercial; não autoriza merge, deploy, migração ou ativação de cobrança/enforcement.  
**Repositório:** `mundodigitalsolucoes/mds-crm-saas`

## 1. Premissa: aproveitar o CRM em funcionamento

O **MDS CRM já está em produção e é utilizado pela Mundo Digital Soluções**. Atendimento baseado em Chatwoot, inboxes de WhatsApp (incluindo API oficial), Instagram, Widget e e-mail, além de Leads e pipeline Kanban, são recursos existentes. **Não reconstruir CRM, Atendimento, Chatwoot, Leads, Kanban ou integrações**. Não criar outro repositório, instalação ou fork por cliente.

A iniciativa atual transforma o SaaS existente em **ofertas de assinatura por módulos**, com **White-Label opcional e independente**, preservando uma única arquitetura, isolamento multi-tenant e o core protegido. Respeitar o fluxo Auditoria → Plano → Implementação → Validação → Relatório.

## 2. Contratação possui dimensões independentes

**Módulos comerciais disponíveis:** `atendimento`, `vendas`, `marketing`. Cada um pode ser contratado isoladamente ou em qualquer combinação. Novos módulos (como Financeiro e Agentes IA) deverão nascer com contrato independente; não estão automaticamente habilitados.

**Identidade da assinatura:** `mds` (marca padrão) ou `white_label` (identidade do cliente). White-Label é um **adicional comercial independente**, disponível com qualquer conjunto de módulos — **não é um quarto módulo de negócio** e não cria novo tenant.

**Contrato lógico:** módulos contratados + limites/capacidades por canal e usuário + identidade (MDS/White-Label) + eventuais adicionais aprovados. Preço, cobrança, limites numéricos, domínio próprio e regras contratuais continuam sujeitos a decisão comercial posterior.

Não confundir: (1) módulo contratado, (2) permissão do usuário, (3) limites de canais, (4) provider de integração, (5) marca White-Label ou (6) organização/tenant.

## 3. Navegação por módulo

| Módulos contratados | Menu principal esperado |
| --- | --- |
| Atendimento | Dashboard, Atendimento, Configurações, Ajuda |
| Vendas | Dashboard, Vendas, Configurações, Ajuda |
| Marketing | Dashboard, Marketing, Configurações, Ajuda |
| Atendimento + Vendas | Dashboard, Atendimento, Vendas, Configurações, Ajuda |
| Atendimento + Marketing | Dashboard, Atendimento, Marketing, Configurações, Ajuda |
| Vendas + Marketing | Dashboard, Vendas, Marketing, Configurações, Ajuda |
| Atendimento + Vendas + Marketing | Dashboard, Atendimento, Vendas, Marketing, Configurações, Ajuda |

Dashboard, Configurações e Ajuda são **compartilhados** e aparecem uma vez. Conteúdo, indicadores e funções respeitam somente os módulos contratados, o papel e as permissões.

Ocultar o menu **não substitui autorização no backend**. Proteger páginas, URLs diretas, APIs, handlers e ações do servidor. Nem o owner pode ativar recursos não contratados. O módulo Vendas isolado não deve depender obrigatoriamente do módulo Atendimento; recursos cruzados só ficam disponíveis quando os módulos necessários estiverem habilitados.

## 4. White-Label: concluir a implementação existente

Auditar os recursos White-Label **já presentes** (logo, paleta, favicon, nome, sidebar, dashboard, telas, rotas, modelo e APIs). Completar **somente lacunas comprovadas**, mantendo a experiência padrão da MDS para clientes sem esse adicional.

A MDS/Super Admin define marca, planos, módulos comercialmente disponíveis e limites. O cliente administra seus usuários e as configurações operacionais permitidas. Identidade, arquivos, permissões e dados devem permanecer isolados por organização.

## 5. Piloto comercial: Ótica São Paulo

- **Assinatura:** Atendimento + Vendas + White-Label.
- **Marketing:** não contratado; oculto na navegação e inacessível por URLs/APIs após homologação da política.
- **Menu esperado:** Dashboard, Atendimento, Vendas, Configurações e Ajuda.
- **Marca:** identidade da Ótica São Paulo, laranja, branco e preto.
- **Operação prioritária:** WhatsApp do número que a ótica já possui, cadastro de Leads e Kanban; aproveitar os módulos já funcionais.
- **Segurança:** dados e inboxes da ótica não podem acessar ou alterar organizações da MDS ou de outros clientes.
- **Canal WhatsApp:** auditar provider e requisitos de conexão do número existente antes de conectar; não presumir migração/coexistência.
- **Módulos adicionais:** poderão ser contratados e liberados posteriormente; não são bloqueadores artificiais para o MVP, desde que os controles essenciais estejam aprovados.

## 6. Implementação mínima: auditoria diferencial primeiro

**A. Inventário, somente leitura**
1. Mapear `Plan.features`, `Organization.features`, serviços de entitlements, autorização, planos legados e resolução já implementada.
2. Identificar menus, dashboard, contratos entre recursos e dependências entre módulos.
3. Auditar o White-Label atual: dados, configuração, UI, APIs, favicon, cores e branding por tenant.
4. Emitir matriz **já existe / falta / impacto / teste**, antes de propor código.

**B. Ajustes pontuais**
1. Reutilizar a fonte de verdade de módulos/planos — não criar motor paralelo.
2. Separar navegação, dashboards, permissões e ações conforme contratação.
3. Corrigir exclusivamente as lacunas do White-Label existente.
4. Preservar compatibilidade dos planos legados e funcionamento da organização MDS.
5. Preparar rollout reversível por organização após testes.

**C. Validação**
- As **7 combinações não vazias × 2 identidades = 14 cenários básicos** devem ser testadas, além de papéis, acesso por URL/API, organizações distintas e regressão MDS.
- Verificar Dashboard, Configurações, Ajuda, WhatsApp/Leads/Kanban, concorrência e persistência.
- PostgreSQL descartável e providers simulados para testes iniciais. Testes reais do piloto exigem autorização específica e isolamento.
- Registrar evidências, CI do SHA homologado, revisão independente e rollback.

## 7. Compatibilidade com plano inicial em seis blocos

1. **Motor de módulos e planos:** aproveitar implementações existentes.
2. **Segurança e permissões:** concluir gates G1–G6 já iniciados, sem refazer o trabalho.
3. **Atendimento e canais:** limites por assinatura, preservando inboxes/providers.
4. **Super Admin SaaS:** gestão comercial de módulos, limites e branding pela MDS.
5. **White-Label e UX:** finalizar personalização já existente, sem clonar CRM.
6. **Piloto e homologação:** Ótica São Paulo, com sessões isoladas e rollback.

Esta frente comercial **refina os seis blocos existentes**; não cria um projeto paralelo.

## 8. Restrições de segurança e de rollout

- Core protegido, isolamento multi-tenant e separação de providers permanecem obrigatórios.
- Não reescrever recursos operacionais estáveis em produção.
- Não ativar enforcement comercial antes dos gates; preservar `observe_only` e `APPROVED_ENFORCEMENTS` vazio até aprovação explícita.
- Não fazer merge, deploy, migrações de produção ou mudanças no Coolify por causa desta decisão.
- Não reintroduzir credenciais no Git. A candidata saneada local `audit/block2-sanitized`, HEAD informado `18507ac`, **ainda exige CI remota e revisão independente**. Não presumir aceite.
- O histórico público anterior com arquivo de testes contendo segredos exige tratamento separado. Esta documentação **não trata** tais segredos como revogados.
- Não confundir decisão comercial com autorização de execução ou ativação.

## 9. Critérios de aceite da frente comercial

1. Assinaturas com somente Atendimento, somente Vendas e somente Marketing funcionam autonomamente.
2. As quatro demais combinações funcionam sem duplicação de áreas comuns.
3. White-Label é aplicável a qualquer combinação; a marca MDS permanece padrão quando não contratado.
4. Owner, admin e membro não conseguem contornar contratos/permissões por requisição direta.
5. Tenants não compartilham dados, inboxes, configurações ou branding.
6. Planos legados e a organização MDS seguem funcionando sem regressões.
7. Ótica São Paulo opera Atendimento + Vendas + White-Label, sem acesso a Marketing.
8. Resultados documentados com testes, revisão independente e plano de rollback.

**Status:** decisão registrada, implementação comercial e homologação ainda pendentes de auditoria diferencial. Não pressupor código novo sem comprovar lacuna.
