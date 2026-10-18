# MDS CRM SaaS — Motor de módulos e assinaturas (piloto Ótica São Paulo)

Status: **especificação inicial, sem implementação funcional**. Branch: `feature/modular-plans-entitlements`. Base: `47bbccc7af03c8b665e3445f77066ae00e7018a0`.

## Decisões aprovadas
- Super Admin controla módulos por plano; módulos comercialmente independentes.
- Atendimento é módulo com habilitação de canais e limites individuais por tipo de canal.
- White-label é uma capacidade comercial; identidade visual controlada exclusivamente pelo Super Admin MDS.
- Owner/admin do tenant gerenciam usuários e operação dentro dos limites da assinatura.
- Dashboard e configurações comuns são plataforma; suas telas/indicadores devem respeitar módulos contratados.
- Piloto Ótica São Paulo: Atendimento + Vendas + White-label; Marketing indisponível.
- Sem fork por cliente, merge ou deploy automático.

## Achados confirmados no código-base
- `Plan.features` e `Organization.features` são strings JSON; `syncPlanLimits` propaga features e limites.
- UI de planos já oferece `atendimento`, `vendas`, `marketing`, `white_label`, canais e add-ons.
- `checkPermission` atualmente permite owner antes de verificar assinatura; não confere `Organization.features`.
- `checkLimits` retorna acesso permitido em exceções, inclusive na validação de plano ativo.
- `/api/organizations` permite PATCH de branding por owner/admin; deve ser reservado ao Super Admin.
- `middleware.ts` não é um guard completo de features e sua lista de rotas não cobre todas as APIs.
- `ROUTE_MODULE_MAP` e `API_ROUTE_MODULE_MAP` são incompletos para servir como única camada de segurança.

## Contrato de autorização a implementar
1. Identificar usuário e organização ativos no banco (não confiar apenas em claims antigas do JWT).
2. Verificar assinatura ativa e entitlement de módulo pela organização; **negação por padrão** para planos novos e configurações inválidas.
3. Aplicar papel/permissões do usuário **depois** do entitlement. Owner não pode ultrapassar plano.
4. Verificar limite por canal no provisionamento e na criação de conexões, não somente na UI.
5. Aplicar guard nas APIs/ações de servidor, inclusive endpoints legados e integrações. Menu é projeção da mesma decisão.
6. Registrar alterações de plano, módulo, limite e branding com ator, tenant, antes/depois.
7. Definir migração/compatibilidade explícita de organizações legadas: **não interpretar features vazias automaticamente como bloqueio universal em produção**, nem liberar tudo sem política. Preparar inventário e migração controlada antes de ativar enforcement.
8. Distinguir módulos operacionais (atendimento, vendas, marketing, futuros financeiro e agentes_ia) de capacidades (white_label, advanced_reports) e de canais (whatsapp, instagram, email, site_widget, google_business).
9. Evitar dependência comercial entre módulos; integrações opcionais podem ampliar capacidades.
10. Desativação de módulo não apaga dados existentes; bloquear ações e acesso conforme política de retenção.

## Implementação em lotes (cada lote revisado antes do seguinte)
- Lote A: catálogo tipado de módulos/capacidades/canais, parser seguro e testes de casos inválidos; sem enforcement ativo.
- Lote B: autorização central no servidor, matriz completa de rotas e APIs, testes de owner, user, tenant cruzado, plano legado e falha de banco.
- Lote C: limites por tipo de canal, provisionamento e integrações, mantendo isolamento de providers.
- Lote D: administração SaaS de planos/branding e leitura consistente de entitlement no frontend.
- Lote E: configuração piloto Ótica São Paulo, homologação multitenant, rollback e autorização de deploy.

## Critérios de aceite
- Marketing oculto e com API/URL bloqueadas para Ótica; MDS não sofre regressão.
- Owner da Ótica não consegue alterar módulos, branding ou limites.
- Canal não contratado ou acima do limite não pode ser provisionado.
- Nenhuma rota de acesso a dados entre organizações; sem vazamento por caches ou integrações.
- Testes automatizados e homologação manual documentados; sem migração/deploy sem aprovação.

## Pendências para implementação
- Inventário exaustivo de APIs e páginas por domínio de negócio.
- Contrato de compatibilidade com planos legados e comportamento de features vazias.
- Definição de limites concretos do piloto (usuários e cada canal).
- Decisão de migração para limites por canal, caso o schema atual não comporte as quantidades.
