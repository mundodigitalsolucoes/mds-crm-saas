# Revisão crítica de evidências — Bloco 02 e frente comercial

**Data:**20/10/2026, America/Sao_Paulo. **Fonte:**audit/block2-sanitized em f1975c9b437b78600328bba5641062e997ae1c58, árvore inicialmente limpa. **Parecer técnico: não aprovar G1–G6 nem iniciar rollout comercial.** Nenhuma aplicação foi alterada nesta revisão.

Esta é uma revisão crítica por sondagens adicionais, executada pelo agente da continuidade. **Não é parecer assinado por implementador distinto nem satisfaz G6 independente.** A consulta GitHub retornou somente mundodigitalsolucoes, a própria conta autenticada; nenhum revisor distinto disponível foi inventado e nenhum review externo foi solicitado. Para aceite, o responsável deve designar pessoa/time independente, que reproduza os casos e registre parecer por gate.

## Integridade e cobertura dos relatórios anteriores

Os9 artefatos do execution-record anterior existem e correspondem aos digests registrados: TAP102, suite171, build, typecheck, smoke22, matriz comercial, auditoria npm, lint e bundle saneado. São hashes de artefatos, não de segredos; nenhum valor de credencial foi usado/exposto. Fonte/testes/esquema/dependências entre18507ac e f1975c9 são idênticos. Isso sustenta os resultados reportados, sem substituir CI ou assinatura independente.

Foram executados agora **26 testes de contratos/boundaries/entitlements/inventário/observação**, todos PASS, zero falha/skip/TODO. O harness comercial foi repetido com saída nova:14 cenários do resolver,126 decisões puras,12 divergências de menu owner e7 logos MDS no SSR White-Label. A suite102/171 e o build anteriores foram verificados por integridade; não são novas execuções completas desta rodada. Não há motivo para revalidar build repetidamente sem alteração de fonte; o próximo lote terá os próprios checks obrigatórios.

## Novo bloqueador comprovado: autenticação/permissão do Dashboard

Teste HTTP adicional usa o build local existente da mesma árvore funcional, NextAuth real, PostgreSQL descartável mds_crm_dev, conta/organização/Lead sintéticos e cookie mantido somente em memória. Nada foi enviado a providers. Fixtures foram removidas ao final.

| Caso | Resultado observado | Resultado exigido |
| --- | --- | --- |
| Conta ativa, controle positivo | Dashboard200 e Lead fictício presente | Acesso legítimo mantido |
| Mesmo cookie após deletedAt do usuário | **Dashboard200 e o mesmo Lead presente** | Negar/redirecionar antes de ler/exibir dados |
| Mesmo cookie após deletedAt da organização | **Dashboard200 e o mesmo Lead presente** | Negar/redirecionar antes de ler/exibir dados |
| Usuário ativo com leads.view=false | **API Leads403; Dashboard200 com Lead presente** | Dashboard não consultar nem exibir Leads para esse usuário |

O probe retorna1 por falha de segurança, não por problema de setup. Dados do HTTP não foram copiados para evidências; apenas status e booleanos. Não foi demonstrado acesso a outro tenant: o achado é persistência indevida do acesso ao próprio tenant removido e desrespeito à permissão de recurso.

Causa encontrada: src/app/(app)/dashboard/page.tsx:57–63 confere presença de organizationId na sessão, mas não chama checkAuth nem valida associação ativa; a partir de98 consulta Leads e outros recursos sem as permissões equivalentes às APIs. O layout pai também carrega favicon sem checagem equivalente de associação ativa. O callback de sessão pode sinalizar banned/organizationDeleted, mas a mera presença desses flags não é uma negação aplicada pela página. Middleware com cookie antigo não substitui revalidação de banco no servidor.

**Prioridade P1, G1/G2 bloqueados.** Primeiro commit proposto deve reutilizar checkAuth e permissões existentes, sem aguardar promoção comercial. Observe_only não autoriza usuário/tenant removido nem expõe recurso negado operacionalmente. Não houve correção de código porque a solicitação atual pede plano para aprovação.

## Ressalvas da auditoria comercial

1. A lacuna de Sidebar é sustentada pelo código e pelo SSR: não há decisão contratual na composição atual; owner vê as três seções. As2 coincidências quando todos os módulos estão contratados não significam filtragem correta.
2. O logo MDS apareceu nos7 casos White-Label, mas o harness **não injeta logo/paleta por tenant**. Logo MDS é fallback válido se o cliente não tiver ativos. A constante BRAND e a ausência de consumo do branding confirmam a lacuna estática; os sete casos não substituem um teste positivo com marca fictícia diferente por tenant.
3. As126 decisões são funções puras, não126 endpoints. Nenhuma evidência aprova bloqueio comercial efetivo de URLs/APIs: a política permanece em observação.
4. O authorizer aceita somente pares auditados: Marketing/projects, Vendas/leads ou kanban, Atendimento/atendimento. Agenda, Tasks, OS, Metas e relatórios não podem ser associados por nome de menu. Adicionar chamadas fora desses pares causaria negação em massa no futuro modo aprovado.
5. White-Label comercial e a autoridade MDS não estão completos: PATCH tenant permite owner/admin editar marca e schema admin não contempla os campos. Preparar o controle não permite retirar essa capacidade silenciosamente de todos os legados em observe_only.
6. DEFAULT_BRANDING difere da paleta MDS real do shell; getOrgBranding não verifica deletedAt e brandingCssVars interpola valores persistidos. O próximo lote deve autenticar o tenant e validar cores/URLs antigas antes de usar esse helper, sem criar helper paralelo ou tornar CSS não confiável executável.

## G1–G6 após esta revisão

| Gate | Parecer e evidência | Risco/condição restante |
| --- | --- | --- |
| G1 | **BLOQUEADO** pelo Dashboard com identidade removida; testes existentes de login/reset/admin mantêm evidência positiva | Corrigir C0 e testar HTTP/consulta zero; browser/e-mail e sessão copiada ainda exigem revisão |
| G2 | **BLOQUEADO** pelo Dashboard que ignora leads.view, além das lacunas comerciais | Corrigir permissionamento antes da consulta; revisão por método não prova todos os caminhos |
| G3 |17 testes Widget e integração com DB/mocks preservados | Providers reais, legado e reconciliação de resultado incerto ainda sem homologação |
| G4 |9 casos PostgreSQL de nonce/replay/assinatura preservados | Meta real, retenção/limpeza e procedimento de estado incerto pendentes |
| G5 | Resolver e decisões teóricas positivos; manifesto vazio confirmado | Legado, compartilhados, UI e APIs no modo de teste aprovado precisam aceite; não ativar |
| G6 | Artefatos íntegros; nova reprodução adversarial verificável | **Não atendido:** falta revisor distinto e CI deste SHA; novo bloqueador, lint e dependências impedem aceite |

182 erros/77 avisos de lint e46 dependências sinalizadas,zero críticas, são resultados anteriores íntegros, não auditoria atualizada do registry nesta rodada. Sem fonte/lock alterados; nenhuma atualização em massa, supressão de regra ou exploração de vulnerabilidade foi executada.

Evidências atuais: [registro sanitizado](evidence/BLOCK2_MINIMUM_PLAN_REVIEW_2026-10-20.json), /workspace/mds-crm-onboarding-evidence/minimal-plan/{dashboard-session-probe,evidence-integrity-review,commercial-matrix}.json e contracts-regression.log. O script de reprodução ignorado é .cache/review-dashboard-session.cjs. Revisão externa deve reproduzir em banco descartável e nunca executar em produção.

Próxima ação: aprovar o [plano mínimo](COMMERCIAL_MINIMUM_EXECUTION_PLAN_2026-10-20.md), iniciando pelo bloqueador C0; definir revisor independente e somente depois autorizar separadamente o [envio seguro ao GitHub](BLOCK2_SANITIZED_GITHUB_REVIEW_STRATEGY_2026-10-20.md). Nenhum gate aprovado, push, merge, deploy, migration de produção ou enforcement realizado.
