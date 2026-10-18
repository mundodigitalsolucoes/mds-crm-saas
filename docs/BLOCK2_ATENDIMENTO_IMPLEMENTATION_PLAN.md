# Bloco 2 — Plano de integração controlada de Atendimento

**Data:** 18/10/2026. **Base:** `2649d3f491e27c82e7467709c0796c4f5c92c1d0`. **Branch existente:** `feature/modular-plans-entitlements`.

**Estado:** proposta documental para auditoria independente, sem autorização de implementação. Atendimento não está integrado ao motor; Bloco 2 não está homologado. Nenhum trecho deste plano autoriza executar código, alterar providers ou testar serviços reais.

## 1. Evidência e limites do plano

Este plano deriva da [auditoria estática](BLOCK2_ATENDIMENTO_AUDIT.md): 58 arquivos/72 métodos principais, 11 páginas, nove arquivos/12 métodos compartilhados e 15 fluxos internos. Cada origem/permissão/provider/efeito está vinculado ao código da base. Referências oficiais: documentos 01/04/7/8/9/14/17 e demais originais preservados, ADR-001, matriz e relatório do Bloco 2.

O motor atual atende identidade humana NextAuth, entitlement por Organization.features, assinatura, permissões e tenant. O manifesto segue vazio. O helper API mantém checkPermission legado antes da avaliação nova; o helper de página redireciona unauthenticated mesmo em observe_only. Ele não impõe todas as negativas operacionais na página em observação, portanto API/ACL nativa continuam obrigatórias. Não usar o helper de página como prova de revogação de sessão externa ou de vínculo individual Chatwoot.

Não recriar motor de autorização/permissões/mensageria. Não inferir identidade pela palavra sync, provider pelo nome WhatsApp ou direito comercial por papel owner/admin. Não substituir integrations por atendimento para fazer o par passar no motor. Nenhum plano de webhook pode depender de cookie NextAuth ou de cobrança/entitlement para receber mensagem.

## 2. Pré-condições e bloqueios anteriores à implementação

| Bloqueio | Condição necessária para prosseguir na parte afetada | O que permanece suspenso |
| --- | --- | --- |
| C01 — Meta Cloud sem assinatura | Revisão independente do ingresso, proposta de autenticação sobre corpo original e vínculo da integração, compatível com o provider. Missão própria de correção e testes isolados. | Expansão de inbound/observação acoplada e qualquer ativação comercial no receptor. |
| C02 — Chatwoot fail-open e outbound | Confirmar configuração de segredo apenas em ambiente autorizado, revisar autenticação e registrar plano de transição que preserve entrega. Testes devem provar origem antes de dispatcher/Graph. | Mudanças que ampliem ingresso/dispatcher ou suponham que account_id autentica evento. |
| C03 — autoridade administrativa | Decisão de segredo obrigatório, papel/existência de SuperAdmin e escopo alvo; revisão do contrato administrativo já preparado e seus consumidores. | Ampliação de provisionamento/admin/cleanup e uso de cast JWT como autorização nova. |
| C04 — reativação pública por e-mail inativo | Correção autorizada de Auth/recuperação com prova de identidade e role/tenant preservados, com evidência de regressão. | Reuso/expansão da reativação e provisionamento automático. Não alterar signup nesta etapa. |
| H01/H02/H04 — Instagram | Propostas próprias de assinatura, state vinculado/uso único, troca de token e resposta diagnóstica sem credenciais. | Integração indiscriminada dos endpoints externos/sem identidade; exposição de diagnóstico bruto. |
| H03/H05/H07/H08/H09/H10 | Provar ownership QR, identidade/ACL/SSO, mapeamento de tenant, isolamento de provider/destino e contenção de sessões/canais. | Declarar que novos guards resolvem lacunas antigas ou liberam homologação operacional. |

**Disposição dos críticos:** planos de alteração que possam agravá-los estão interrompidos. Os passos abaixo são propostas condicionais para recortes futuros autorizados, não instrução de execução agora. Leituras humanas A1 que não ampliem ingresso/provisionamento podem ser revisadas separadamente; isso não libera credenciais/SSO, callbacks, lifecycle ou produção. A auditoria documental pode ser concluída sem executar as correções.

Não é necessário decidir regras comerciais novas para terminar estes documentos. Decisões pendentes estão registradas na seção 8; a próxima implementação depende de aprovação expressa do recorte, preservando as restrições da missão vigente até nova autorização.

## 3. Etapa A — superfícies humanas

### A1. Rotas que já usam permissão atendimento

**Candidatas de menor acoplamento:**

- `src/app/api/atendimento/agentes/route.ts` — GET atendimento:view.
- `src/app/api/atendimento/inboxes/route.ts` — GET atendimento:view.
- `src/app/api/atendimento/equipes/route.ts` — GET atendimento:view e POST atendimento:create.
- `src/app/api/atendimento/equipes/[teamId]/route.ts` — DELETE atendimento:delete.
- `src/app/api/atendimento/equipes/[teamId]/members/route.ts` — GET view, POST/DELETE edit em atendimento.
- `src/app/api/atendimento/inboxes/[inboxId]/members/route.ts` — GET view, POST/DELETE edit em atendimento.
- `src/app/api/atendimento/agentes/sync/route.ts` — POST atendimento:edit; é ação humana que grava User, não job.

**Maior risco, recorte separado:** `src/app/api/integrations/chatwoot/credentials/route.ts` (GET atendimento:view, CORE máximo) e `src/app/api/atendimento/session-diagnostics/route.ts` (GET atendimento:view, gera link SSO). Exigem resolução/plano aprovado de H05; não incluí-las como simples leituras sem efeito. Nenhuma mudança em `src/app/(app)/atendimento/page.tsx` é necessária para propor um layout externo, mas o comportamento SSO/iframe deve ser homologado antes de qualquer entrega de código nessa fronteira.

**Página candidata:** novo `src/app/(app)/atendimento/layout.tsx`, sem substituir o client component protegido. Novo `src/app/(app)/settings/atendimento/equipes/layout.tsx` pode ser avaliado como recorte específico; não aplicar layout comercial ao pai /settings inteiro. Proteção do hub/canais/widget/Instagram requer A2 e análise de grants atuais. Auth obrigatória não é enforcement comercial; manter os gates operacionais existentes.

**Estratégia proposta:** um fluxo por vez, começando por listagem humana sem criação de recurso externo; compor checkModulePermission com `{module: atendimento, permission: atendimento, action: ação atual}` na borda. Preservar respostas/erros, IDs externos e caminhos Account API. O wrapper não substitui validação de propriedade de inbox/team/agent nem autenticação do backend externo. Sem sessão/usuário removido/tenant inválido/permissão legada, API deve negar antes de provider; sem módulo/assinatura na decisão nova, observe_only registra e preserva o contrato legado. Nenhum owner/admin bypass novo.

**Pré-requisitos:** aprovação do recorte nominal e leitura de H05/M03/M04; fixtures com duas contas e mapas de agentes/inboxes; catalogar efeitos do GET diagnostics; validação de membership externo antes de declarar escrita segura. Não migrar User/roles/visibilidade.

**Testes:** helper legado e motor reais com adapters de infraestrutura simulados; parâmetros/role/module forjados não afetam escopo; permissão por método e respostas positivas idênticas; erros do novo motor permanecem negativos e só observados; nenhuma chamada externa nos negativos operacionais. Layout com redirects reais do framework em ambiente isolado futuro e regressão de Projects/Leads/Kanban. Para SSO: usuário vinculado/não vinculado, flag atual, fallback, account mismatch, sessão prévia e remoção de acesso — sem trocar a flag para obter teste passando.

**Impacto/riscos:** reads adicionais do usuário/org, logs finitos e ausência de cache entre tenants; mudança de navegação para visitante. Mutação/membership externos e sessão do iframe mantêm riscos próprios. Limitar logs a módulo/permissão/ação/motivo; nunca tokens, URL SSO, contatos ou conteúdo. Não afirmar que renderizar shell implica dado exposto ou que ocultar menu impõe ACL.

**Rollback futuro:** reverter somente commit do fluxo humano/layout, mantendo motor, docs e demais módulos; nenhuma exclusão/provisionamento para reverter guard. Revisar que retirar layout volta a permitir comportamento anterior de shell no dev. Rollback de guard não revoga SSO emitido nem restaura equipe removida; esses efeitos precisam de plano específico antes de autorizar escrita.

### A2. Rotas humanas com permissão integrations

**Arquivos candidatos nominais:** todas as rotas humanas de `src/app/api/atendimento/canais/`, `src/app/api/atendimento/widget/`, configuração/ações humanas de `src/app/api/atendimento/instagram/`, `src/app/api/integrations/chatwoot/` exceto credentials, `src/app/api/integrations/evolution/` e `src/app/api/integrations/whatsapp-cloud/`. Métodos/permissões e exceções constam no inventário; não incluir callback/webhook/exchange-token como se já fossem humanos autenticados. As cinco rotas congeladas (quatro whatsapp legadas e evolution/setup-inbox) devem continuar 410, sem serem reativadas ou utilizadas como nova trilha.

**Pré-requisito indispensável:** o motor atualmente só aceita o par atendimento/atendimento. Aprovar uma associação servidor **nominal e auditada** para as rotas integrations deste domínio, preservando a permissão operacional de cada uma e as demais integrações compartilhadas. Se for necessário ajustar `src/lib/authorization/authorize.ts`, isso é recorte novo sujeito a revisão de impacto e regressões Marketing/Vendas. Não passar integrations esperando decisão positiva hoje, nem criar permissão paralela ou renomear grants existentes. A capacidade comercial integrations também não implica permissão do usuário.

**Ordem possível após resolver bloqueios:** leituras sem efeitos de provider → configuração local → ações manuais com provider validado → lifecycle em C. QR bloqueado por H03; debug-business-pages por H04; SSO/contas compartilhadas por H05; ingressos Instagram por H01/H02. Conectores/instances/status não são automaticamente leituras: GET pode espelhar legado, escrever estado e gerar QR. O banner global exige revisão D para evitar condicionar acesso a outros módulos a uma consulta de Atendimento.

**Páginas candidatas:** layouts específicos para hub/canais/widget/Instagram apenas após decisão de permissão e fronteira comercial. Não transformar settings:*/integrations:* da plataforma em Atendimento por abrangência de diretório. Preservar OAuth público de retorno e visitor do widget, que não recebem sessão humana.

**Testes:** matriz por rota/método/role/custom grants; caso explícito contratado + integrations:view que deve ser observado corretamente após mapeamento aprovado; APIs de outros providers/módulos sem alteração; nenhuma chamada externa para ID/instance de outro tenant; regras atuais de plano/quota/-1/0/positivo intactas; respostas 410 e negativa operacional intactas. Fronteiras de segurança corrigidas precisam de testes próprios, não só de entitlement.

**Impacto:** possível aumento de reads e divergências de telemetria se mapa errado; troca de par/grant pode bloquear clientes em ativação futura. Configurações e IDs externos podem gerar efeitos no serviço. **Rollback:** reverter primeiro os imports/wrappers das rotas, depois eventual mapa de pares; layouts no mesmo recorte ou reversão anterior aos helpers. Não reverter dados, desligar canais ou modificar o manifesto para recuperar acesso.

## 4. Etapa B — superfícies técnicas

**Arquivos/fluxos candidatos:** `src/lib/atendimento/orchestration/chatwoot-events.ts`, `lead-bridge.ts`, `providers/whatsapp-cloud-inbound.ts`, `providers/whatsapp-cloud-outbound.ts`; funções Account/Platform em `src/lib/chatwoot.ts`, provisionamento/cleanup e registro de webhook em `src/lib/integrations/` permanecem dependências técnicas dos chamadores. Não há route de job autenticado dedicado encontrada; eventual job futuro precisa de identidade de serviço própria aprovada.

**Identidade:** preservar autenticação da entrada C ou A e credenciais técnicas de saída, com org derivada de integração verificada. Não chamar createModuleAuthorizer fornecendo usuário/role fictícios, nem fabricar sessão para satisfazer um guard. O contrato central atual é humano; não suporta formalmente ator técnico.

**Plano condicionado:** primeiro resolver C01/C02/H01/H02 e ambiguidades H07; depois avaliar se cabe um diagnóstico somente leitura sobre o snapshot usando o resolvedor existente. Isso não é concessão de direitos operacionais nem decisão de autorização humana. Se houver necessidade de contrato formal de autorização de serviço, registrar proposta/decisão arquitetural específica, sem construir segundo motor. Nenhuma negativa comercial, feature inválida, dívida ou erro de leitura poderá impedir recebimento/ACK/processamento já autorizado tecnicamente. Escolher ponto de observação que não faça o sucesso operacional depender do banco comercial/telemetria.

**Pré-requisitos:** definição de ator técnico e cadeia de confiança; payload autenticado, mapeamento único e tenant ativo conforme política operacional aprovada; decisão de tratamento de org removida/retensão separada de cobrança. Contenção de org removida é segurança, não quota. Não resolver desativação inteira bloqueando toda mensagem por planStatus.

**Testes futuros:** não há cookie humano nos requests externos; sessão ausente não muda recepção válida; features vazias/inválidas/desconhecidas/assinatura cancelada produzem somente observação comercial, mantendo autenticação técnica; falha de diagnóstico não afeta pipeline de mensagem; dois tenants/ID duplicado/inativo mapeiam corretamente ou ficam controladamente sem destino conforme contrato. Logs não incluem IDs pessoais, payloads, conteúdo ou credenciais. Simular replay, erro de DB/HTTP e rede sem chamá-la.

**Impacto:** latência, disponibilidade, vazamento em logs e reprocessamento; observar por mensagem sem limites pode saturar logs/DB. Nenhuma fila nova, retry compartilhado ou cache entre tenants é parte do plano aprovado atual. **Rollback:** retirar apenas observação, mantendo autenticadores técnicos e correções de segurança aprovadas; não reenviar eventos, refazer mensagens ou limpar cache como rollback automático. Não voltar a fail-open para recuperar compatibilidade.

## 5. Etapa C — providers, onboarding e lifecycle

Não executar esta etapa sob a missão documental. Todas as propostas exigem novo recorte autorizado com evidência, risco, testes externos em ambiente próprio e rollback operacional. Nunca misturar provider para facilitar um guard.

| Trilha/arquivos candidatos | Pré-requisitos e testes necessários | Impacto e rollback futuro |
| --- | --- | --- |
| Chatwoot: credentials, chatwoot.ts, chatwoot-provision.ts, chatwoot-webhooks.ts, lead-bridge/events e webhook route | C02/C03/C04/H05/H07; decidir SSO/ACL individual e revogação. Confirmar assinatura/segredo técnico, account/host único, API Account e Platform, roles/visibilidade/inbox/team, logout de sessão existente e retorno de webhook sem usuário. Testes de mocks primeiro; iframe/API externos só em sandbox autorizado. | CORE máximo. Sessões são externas; novos guards não as encerram. Rollback de emissão/guard não desfaz usuário/account/webhook criado. Preservar configuração anterior e plano de restauração explicitamente aprovado, sem trocar imagem/banco. |
| Evolution: evolution/*.ts, evolutionClient.ts, channel-lifecycle.ts, channel-status.ts, chatwoot-evo.ts | H03/H08/M01/M02; resolver ownership por tenant e provider antes de QR/connect/logout/delete. Validar duas instâncias, dois tenants, mesmo ID inválido, estado connecting/open/archived, falhas parciais e corridas; nativo Evolution↔Chatwoot em ambiente isolado com número/inbox de teste autorizados. | Chave global e efeitos externos de pareamento/remoção. Reverter guard não reconecta sessão nem recupera inbox deletada. Backup de configuração e procedimento próprio do provider, sem reutilizar lifecycle Cloud. |
| Meta Cloud: canal dedicado connect/delete, setup/status/validate, inbound/outbound e webhook | C01/C02/H06/H07/H08/M01/M02/M05; aprovar autenticação app/evento e ligação WABA/phone/tenant; proteger token sem migrar no escuro; diferenciar setup de canal; simular nota privada, tipos/mídias/status, duplicatas e 50 IDs; M07 exige conferir Lead/cache também, sem supor que ignore de incoming mantém bridge. Sandbox externo futuro precisa de conta/número/token de teste e autorização explícita. | Isolado de Evolution. Não aprovar quota, novo armazenamento ou migração nesta missão. Rollback conserva autenticidade do ingresso e não apaga inbox/canal como compensação automática; mapear efeitos parciais e reconciliação aprovada. |
| Instagram: connect/callback/exchange-token/webhook, config, select/sync/accounts/debug/create-inbox/subscribe | H01/H02/H04/H07/M01/M05/M06; state autenticado/vinculado e consumo único; projeção de tokens; mapeamento sem duplicidade; conta de teste própria; provar recebimento/ACK, resposta de API inbox e ausência de regressão de seleção. Decidir contrato do exchange-token sem identidade e página fixa. | Não supor envio completo implementado. Settings são compartilhados; rollback não restaura token rotacionado nem desfaz inscrição Meta. Guard humano só em ações humanas; callback nunca bloqueado por falta de sessão NextAuth. |
| Email/Google: canais/email, google/authorize e providers/email.ts | Contrato de OAuth fica no Chatwoot. Validar URL de autorização, inbox da conta/tipo Email, revogação e resposta sem senha/token; futura integração externa só sandbox com autorização. | Remover/reauthorizar inbox é operação externa própria; não unificar tokens com WhatsApp nem interceptar callback Google com guard CRM. |
| Website: widget/config/provision/agents, public/widget e loader | H05/H09/M01/P01; validar destino backend e principal agent, preservar websiteToken público/SDK; idempotência create/update/404, domínio/enable/publicação e visitante sem sessão; sandbox externo somente se autorizado. | Publicação não é login do agente. Rollback de configuração/guard não elimina inbox e não deve recolher uma credencial pública como se fosse token administrativo. Novo modelo comercial por domínio/canal continua pendente. |

**Condições transversais:** 1 número WhatsApp = 1 inbox = 1 canal; validar que o mesmo número não foi ligado a providers diferentes. Quantidade de connectedAccount/config não comprova canais conectados/contratados. Não criar canal, ligar número, enviar mensagem, iniciar Rails runner, executar SQL Chatwoot ou mudar estado remoto para validar documentos. Essas são ações futuras dependentes de autorização, nunca comandos implícitos deste plano.

## 6. Etapa D — recursos compartilhados e administração

**Arquivos candidatos para revisão própria:** `src/app/api/users/route.ts`, `users/invite`, `users/[id]`, `users/[id]/permissions`, `auth/me`, `auth/delete-account`, `auth/signup`, `admin/users/[id]`, `admin/organizations/[id]`, `admin/orgs/[orgId]/provision-chatwoot`; `src/components/integrations/WhatsAppStatusBanner.tsx`; helpers de provisionamento/cleanup. Leads/Tasks/Agenda/Notification e `/reports` mantêm seus recortes de domínio, sem guard global novo.

**Contratos a decidir:**

- Um convite de membro CRM pode provisionar agente; não tornar o acesso a outros módulos dependente de Atendimento sem decisão comercial. Diferenciar papel CRM, permissão individual, visibilidade e role nativa de agente. C04 bloqueia reativação pública como reaproveitamento de onboarding.
- M07 registra que a trilha Cloud atual não chama o bridge comercial nesse caminho; decidir sincronização/idempotência sem presumir cobertura. Lead/Activity/cache gerados por recebimento não são operação humana de `/api/leads`. Proteger tecnicamente a entrada e manter tenant, sem aplicar o guard humano de Vendas para impedir criação automática. Política para organização com Atendimento contratado e Vendas não contratado é decisão de dados/visibilidade, não apagamento automático.
- Tasks/Agenda podem apontar Lead e Project. Não classificá-las todas como Atendimento, nem reverter a integração Vendas/Marketing. Permissões de relatórios/notificações e informação no banner precisam de regra por recurso.
- Admin precisa de identidade/escopo explícitos independentes do entitlement do cliente para contenção e regularização. Não conceder bypass comercial a owner/admin tenant. Corrigir C03 e H10 exige proposta própria de administração/cleanup, jamais chamar authorizeModuleAccess com usuário inventado.
- Remoção/revogação deve considerar sessão externa já emitida, papel/visibilidade e todos os canais. Conta sem débito não é sinônimo de identidade ativa; cobrança/retensão/revogação são decisões distintas.

**Testes:** membros de dois tenants, mudança de papel/permissão/visibilidade após sessão, usuário removido com iframe já aberto, convite sem módulo Atendimento, contenção administrativa sem impersonação, consumidores de permissões/auth/me intactos, lead automático respeitando tenant sem dependência de sessão humana, regressões de Vendas/Projetos/Tasks/Agenda sem chamadas reais. Cleanup/provisionamento sempre mockados na suíte unitária.

**Impacto:** alterações de Auth/membership/cleanup afetam todo o produto e sessões persistentes; dependência máxima, portanto autorização própria. **Rollback:** por recorte pequeno; guard/imports antes de helper; sem reset/force-push, remoção de usuários, reativação automática de organização ou SQL de reversão presumido. Preservar correções de segurança aprovadas; restaurar dados externos exige procedimento separado e evidência.

## 7. Matriz de testes e critérios de aceite para uma implementação futura

| Área | Casos mínimos e resultado exigido |
| --- | --- |
| Identidade humana | Anônimo/usuário removido/org inválida-inativa/tenant trocado negam antes de leitura de recurso/provider. Página sem sessão redireciona; comportamento de membership/operacional da página explicitamente definido. |
| Permissões | Grant por ação/método, custom permissions, role/permissão alterada após sessão; aliases não ampliam direitos silenciosamente. Integrações de outros módulos preservadas. |
| Comercial observado | Owner/admin sem atendimento, usuário com módulo mas sem permissão, assinatura inativa, features inválidas/desconhecidas e falha do motor; decisão teórica negativa não vira grant e observe_only mantém contrato legado. Manifesto vazio confirmado. |
| Enforcement | Somente injeção isolada em testes quando necessário; nunca env/query/header/payload real ou entrada de manifesto para testar. |
| Tenant/provider | Instância/inbox/team/agent externo, nome QR estrangeiro, IDs repetidos/ambíguos, org soft-deleted, Account ID/host inconsistentes; zero efeito remoto para destino inválido. Cloud não chama Evolution e vice-versa. |
| Eventos externos | Assinatura/segredo/state ausentes-inválidos-expirados-repetidos e válidos; validar corpo original antes de efeitos; GET handshake preservado; recepção válida não depende de sessão/cobrança. |
| Entrega | Evento duplicado, concorrência, falha parcial Graph/Chatwoot/DB, ACK e retries, anexos/status/nota privada, idempotência de setup/delete; sem alegar exatamente uma vez sem prova. |
| Sigilo | Tokens sentinela nos mocks não aparecem em respostas/logs/URLs públicas; URL SSO protegida/no-store; websiteToken identificado como público, payload PII minimizado; destino backend verificado. |
| Legado | maxWhatsappInstances -1/0/positivo sem conversão; status e quota antigos; Cloud setup × operacional, shadow Evolution, 410 congelados, snapshots legados; sem migração/correção de dados automática. |
| Transversal | Suíte existente completa, TypeScript/build/Prisma/diff conforme mudança futura; fontes protegidos e hashes oficiais preservados. End-to-end real só em ambiente e recorte explicitamente autorizados. |

Critérios de aceite por recorte: plano aprovado antes do código, conjunto exato de rotas/métodos/permissões, origem/tenant demonstrados, respostas funcionais preservadas salvo correção de segurança explicitamente aprovada, testes negativos/positivos e fronteira sem efeito externo indevido, rollback próprio e revisão independente do SHA. Nenhum aceite parcial autoriza enforcement, deploy ou Bloco 3. A conclusão de documentação desta missão não precisa nem autoriza executar os testes futuros de provider.

## 8. Decisões pendentes e ordem de continuidade

1. Priorizar correções específicas C01–C04 e propostas H01–H10 com responsáveis de Auth/Atendimento/providers, conservando recepção/identidade técnica. Conhecer configuração real exige missão própria; não pressupor que um secret esteja ausente em produção.
2. Aprovar identidade individual/integração, ACL/visibilidade, revogação e comportamento de SSO existente. Não usar UI white label como fronteira de autorização.
3. Aprovar a lista de pares atendimento/integrations por rota, aliases e compartilhados, sem ampliar toda a plataforma.
4. Definir prova de posse/vínculo provider/account/host/phone/inbox e tratamento de duplicatas/órfãos/org removida. Sem mudança Prisma ou migração implícita.
5. Definir política comercial de leitura/egress/retensão para módulos desativados/assinatura inativa, preservando ingresso técnico; manter observe_only até inventário e homologação.
6. Disponibilizar, apenas para próxima missão autorizada, ambiente externo de teste e dados sintéticos sem credenciais reais; validar recortes humanos A1 → A2 e dependências B/C/D conforme bloqueios, sem paralelizar alterações críticas por conveniência.

Quotas/canais quantitativos, persistência futura, ilimitado e números do piloto continuam pendências comerciais de etapa posterior; não implementar ou iniciar Bloco 3. Nenhuma decisão oficial foi alterada neste plano. Se uma futura proposta conflitar com os canônicos, registrar divergência e obter decisão antes de mudar arquitetura.

## 9. Validação documental e rollback desta entrega

O relatório registra os comandos realmente executados. Nesta missão só se valida inventário/links/linhas, integridade dos documentos, ausência de alteração de runtime e verificações locais existentes não destrutivas. Não criar novos testes de integração de Atendimento como se já estivesse implementado; testes futuros acima não foram executados.

Alterações autorizadas: este arquivo, `docs/BLOCK2_ATENDIMENTO_AUDIT.md` e suplemento de evidências em `docs/BLOCK2_ACCESS_MATRIX.md`. Reverter o commit documental final desfaz somente esses três documentos e preserva 2649d3f, todos os fontes e os originais oficiais. Não há rollback de dados/provider por inexistência de operações reais.

Comparação: https://github.com/mundodigitalsolucoes/mds-crm-saas/compare/2649d3f491e27c82e7467709c0796c4f5c92c1d0...feature/modular-plans-entitlements . Commit final na entrega.

**Encerrar após relatório e aguardar auditoria independente e autorização da próxima implementação. Sem Atendimento integrado ou Bloco 2 homologado; sem branch/PR novo, merge, deploy, dados reais, migração, alteração de runtime/Auth/middleware/webhook/provider/lifecycle, enforcement ou Bloco 3.**
