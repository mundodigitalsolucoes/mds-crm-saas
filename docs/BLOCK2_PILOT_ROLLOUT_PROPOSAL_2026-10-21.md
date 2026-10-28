# Ótica São Paulo — proposta de rollout, sem ativação

**NÃO AUTORIZADO / NÃO EXECUTADO.** A organização piloto desta rodada é fictícia. Nenhum cadastro real, Coolify, provider, banco de produção ou manifest de enforcement foi alterado. `observe_only` global e `APPROVED_ENFORCEMENTS=[]` continuam intactos.

## Decisão necessária

Contrato: Atendimento + Vendas + capacidade separada White-Label; Marketing indisponível. Navegação/indicadores seguem esse contrato, mas **observe_only não o impõe por URL/API**. O teste HTTP atual encontrou sete superfícies Marketing acessíveis nos três papéis: 21 expectativas comerciais reprovadas; `/api/projects` retorna dados locais de Marketing nos três casos. Não se trata de acesso entre tenants. É proibido apresentar o piloto como homologado com esse resultado.

Habilitar somente uma entrada no manifest **não basta**: as lacunas C5-03/C5-04 já documentadas continuam existentes. O motor atual cobre pares marketing/projects, vendas/leads ou kanban e atendimento/atendimento. Recursos compartilhados, canais e formatos legados precisam de política/revisão explícita; uma regra por wildcard de URL ou retirada avulsa de permissões não satisfaz o contrato.

## Lote proposto para autorização futura

| Etapa | Arquivos/contratos a revisar | Evidência necessária antes de avançar |
|---|---|---|
| R1 — Fechar cobertura | Inventário C5 e layouts/APIs de `/projects`, `/tasks`, `/os`, `/reports`; comentários/anexos e operações indiretas conforme entidade | Classificação por método, dado e efeito; não inferir cobertura pela Sidebar |
| R2 — Recursos compartilhados | Contrato existente de tarefas/follow-ups, Agenda, Metas, relatórios e vínculos Leads/Projetos | Decisão MDS por recurso/contexto: preservar follow-ups de Vendas e Dashboard compartilhado; não bloquear toda `/api/tasks` nem conceder Leads por Marketing |
| R3 — Compatibilidade | `src/lib/authorization/authorize.ts`, resolver e formatos de permissões/features já existentes | Resolver C5-04 sem tornar JSON corrompido permissivo: formatos parciais legítimos, plano/trial, identificadores legados e dados reais somente com autorização de leitura |
| R4 — Integração mínima | Guards/layouts/handlers responsáveis, reutilizando `checkModulePermission`, `checkModulePage` e o mesmo resolver | Nenhum motor, permissão artificial, modelo de dados ou bypass owner novo; justificar previamente eventual alteração de core protegido |
| R5 — Homologação isolada | Matriz de módulos × marca × papéis × dois tenants; HTTP real por método; negações antes de consultas/efeitos | Marketing sem acesso para piloto inclusive owner; Atendimento/Vendas/White-Label e operação MDS intactos; callbacks/providers com política de continuidade definida |
| R6 — Revisão/CI | PR #15 e SHA final aprovado | Autorizar atualização da PR separadamente; quatro CIs no novo SHA e revisão independente das correções/contratos |
| R7 — Ativação nominal | **Somente depois de autorização específica**, seletor existente em `src/lib/authorization/policy.ts` | UUID real do piloto confirmado pelo operador, referência nominal de aprovação e flags de inventário/cobertura realmente revisados; nenhuma outra organização em enforce |

**R1–R4 não foram implementadas neste lote. R7 não está pronta para execução.** A aprovação de testes simulados não preenche automaticamente flags de revisão nem autoriza uma entrada no manifest. O código atual não possui interruptor de env/header/query/body para ativação e não será criado um. O default das demais organizações deve continuar observe_only.

## Testes isolados preparados nesta rodada

`tests/pilot-contract-postgres.test.mjs` usa duas organizações fictícias no PostgreSQL, contexto autenticado e Sidebar reais, e motor/guards existentes. Em um adaptador de teste, simula o efeito `enforce` **somente** para a fixture piloto: Marketing/projects recebe API403/página notFound, Vendas/Atendimento permanecem permitidos e a MDS não muda. `modeForOrganization` real continua observe_only durante todo o teste; nenhum arquivo de manifest/registro/configuração é modificado.

Essa prova cobre apenas os quatro pares já suportados. **Não representa bloqueio HTTP integral nem resolve rotas sem guard, recursos compartilhados, providers ou C5-04.** A execução HTTP real permanece no modo atual e retorna FAIL comercial, de forma intencional e visível.

## Requisitos operacionais antes do piloto real

1. Registrar SHA/imagem, URL de destino, organização nominal, módulos/capacidade e papéis; White-Label habilitado pela autoridade MDS, nunca pelo owner do cliente. Nenhuma URL foi inventada ou ambiente provisionado nesta execução.
2. Conferir com o operador a compatibilidade PostgreSQL e o histórico Prisma; reconciliar migrations antigas e aditivas de Instagram/Widget. A correção de comentários não muda schema. Qualquer migration de produção exige autorização própria, não o prestart indiscriminado.
3. Homologar em sandbox os canais efetivamente contratados e suas credenciais/bindings separados, inclusive Widget Chatwoot e reconciliação sem recriação. Sem uso de produção para provar isolamento.
4. Registrar backup verificado, imagem/configuração anterior segura, operador responsável, smoke por papel e observabilidade sem segredos; realizar revisão dos alertas de dependências altos relevantes.
5. Obter aceite independente/operacional e autorizações distintas para envio da candidata, ativação nominal e publicação. CI verde não substitui esses aceites.

## Rollback proposto

Antes de qualquer rollout autorizado, preservar configuração e imagem seguras. Se o enforcement nominal causar regressão, retirar **apenas a futura aprovação do piloto** pelo mesmo manifest e promover uma imagem/configuração segura com autorização; demais organizações não devem mudar. Isso retorna o piloto a observe_only, **reabrindo acesso comercial a Marketing**, portanto exige suspender/limitar o piloto até corrigir, não declarar contrato atendido.

Não reverter correções P0/P1/P2 de isolamento/autorização. Não apagar nonces/recibos de webhooks, registros duráveis de Widget ou IDs remotos; não restaurar backup que reabra replay ou permita inbox duplicada. Resultado remoto incerto requer reconciliação com provider antes de nova criação. A proposta não executa deploy, mudança de configuração ou rollback.

**Autorização específica de enforcement continua obrigatória, mas só deve ser solicitada para execução após R1–R6 terem resultado revisável e cobertura suficiente.** Até lá, o piloto permanece bloqueado por contrato comercial comprovadamente não atendido.
