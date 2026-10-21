# Bloco 02 — relatório consolidado de auditoria e validação local

**Decisão: NÃO HOMOLOGADO. Nenhum gate G1–G6 aprovado formalmente.** Sem merge, push, deploy, publicação ou alteração em produção. Dados, usuários e credenciais usados nos testes são fictícios; providers foram simulados. O único PostgreSQL utilizado foi `mds_crm_dev` em loopback.

A avaliação usa os documentos oficiais `BLOCK2_CLOSURE_EXECUTION_2026-10-19.md` e `BLOCK2_CLOSURE_GATE_2026-10-19.md`, encontrados por leitura do histórico e da branch remota `feature/modular-plans-entitlements`. Base efetivamente avaliada: **cb1884e413203baa123ca94dfb0a4c4635b6502a**, em branch local **audit/block2-closure**, no mesmo checkout isolado. Não houve merge da candidata em main. As evidências anteriores de main (`47bbccc`) são históricas e não foram atribuídas à candidata. O defeito de assignee estrangeiro de main já estava corrigido na candidata e foi confirmado negado por HTTP 400.

| Gate | Evidências obtidas | Status e pendências |
| --- | --- | --- |
| **G1 — Autenticação/C03-C04** | Handlers reais, PostgreSQL, bcrypt e JWT reais: login admin, cookie HttpOnly, segredo ausente/fraco, senha/JWT/algoritmo/papel inválidos, admin removido/e-mail alterado, logout de cookie, negativa de provisionamento anônimo; signup concorrente sem tenant órfão; usuários/tenants removidos não reativados; emissão/consumo concorrentes de reset e convite legítimo. Login NextAuth real também validado por HTTP | **Validação local positiva; não homologado.** Transporte de sessão/cookies/email/providers nos testes de handlers é simulado. Revisão independente e validação integral de browser/middleware permanecem pendentes. Logout não foi certificado como revogação de cópia roubada de JWT |
| **G2 — Autorização** | Inventário: 116 arquivos, 177 métodos, 50 páginas/layouts; nenhum literal `use server` encontrado. Artefato por método usa AST e registra sinais, sem presumir proteção. Três papéis e tenant divergente testados. Corrigida elevação por papel antigo no JWT e autenticação Asaas sem segredo | **PARCIAL.** O inventário original aponta 47 linhas para revisão manual; isso é heurística, não 47 vulnerabilidades. Falta revisão completa por método, recursos indiretos e exceções documentadas, além de matriz de operações sensíveis |
| **G3 — Multi-tenancy/providers** | Dois tenants, contas Chatwoot com mesmo nome de inbox, isolamento de leads via HTTP, QR e quatro operações de lifecycle Evolution negando IDs estrangeiros antes do provider, rejeição de Cloud no QR, adapter Google por tenant e rejeição de URL hostil. Meta/Widget com banco real e mocks | **BLOQUEADO.** Widget duplica inbox após sucesso remoto + perda da reserva por outro escritor. Reconciliação e identidade duráveis da operação ainda faltam. Não há comprovação integral de todos os caminhos de cada provider |
| **G4 — Instagram/replay** | Autorizada preparação PostgreSQL/migration para revisão e teste local. Hash de nonce, consumo atômico, limite de emissão, vínculo ativo de usuário/tenant, HMAC preservado, recibos de webhook duráveis por identidade de mensagem. Nove testes reais de banco/handlers aprovados, incluindo concorrência e reentrega com outro cliente Prisma | **CANDIDATO LOCAL, NÃO HOMOLOGADO.** Produção não autorizada. Pending/remote_unknown bloqueiam retry e precisam de reconciliação; não existe garantia de entrega exatamente uma vez. Retenção/operação, falhas remotas e validação real dos providers exigem revisão |
| **G5 — Entitlements** | `observe_only` e `APPROVED_ENFORCEMENTS=[]` preservados byte a byte. Suítes de contratos/legado executadas. Nenhuma política, limite, plano ou bloqueio comercial novo foi ativado | **PRESERVADO, NÃO APROVADO PARA ENFORCE.** Matriz comercial, recursos compartilhados, compatibilidade e rollout por tenant continuam sujeitos às decisões do planejamento. A correção Asaas alterou somente autenticação; o processamento dos eventos permanece igual ao baseline |
| **G6 — Homologação final** | Build, Prisma e typecheck aprovados; instalação idempotente; evidências PASS/FAIL/TODO registradas; workflow preparado com bloqueio de TODO de segurança; planos de rollback documentados | **BLOQUEADO.** Widget, lint global, vulnerabilidades de dependências, CI remoto não confirmado, revisão por responsável distinto e ensaio/aceite de rollback continuam pendentes |

## Resultados executados

Ambiente: Node 24.19.0, npm 11.9.0, Next 16.2.6, Prisma 5.22.0, PostgreSQL 16. Comandos da aplicação executados em `/workspace/mds-crm-saas`.

| Comando/verificação | Resultado |
| --- | --- |
| `npm ci --cache /workspace/.npm-cache` e `npx prisma generate` | PASS; lockfile preservado, sem bypass de TLS/checksum |
| `npx prisma validate` | PASS |
| `npx tsc --noEmit` | PASS final, status 0 |
| `npm run build` | PASS, status 0; 156 páginas geradas e quatro workers |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, sem skip/todo/falha |
| `BLOCK2_TEST_DATABASE_URL` local + `node --import tsx --test tests/*.test.cjs tests/*.test.mjs` | **89 PASS e 1 TODO executado com asserção falhando**; nenhum skip. O retorno 0 do runner por TODO NÃO aprova a segurança |
| Smoke HTTP autenticado, `.cache/bloco02-smoke.cjs` | **22 PASS**; CSRF/login/sessões, leads, IDOR, assignee estrangeiro negado, usuário removido e rate limit. Agenda: um evento para oito POSTs simultâneos, um 201 e sete 409 |
| Comando equivalente ao novo workflow: `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, seguido da barreira de TODO | Runner registra a falha conhecida; **barreira de aceite retorna 1**, como esperado |
| `npm run lint -- --output-file .../eslint-final.json --format json` | Ferramenta compatível executa; **218 erros e 77 avisos** no projeto completo. Nenhuma regra foi desativada |
| ESLint nos arquivos de código/testes/configuração alterados | PASS, status 0 |
| Auditoria npm | 49 dependências sinalizadas: 2 críticas, 37 altas, 8 moderadas, 2 baixas. Next e next-auth críticos. Evidência reaproveitada com lockfile idêntico; não se afirma exploração de todos os advisories |
| `bash .cache/install-cloud.sh` atualizado | PASS repetido, status 0; histórico selecionado preservado e diff local vazio |
| `npx prisma migrate status` | Status 1 esperado por duas migrations de dados deliberadamente pendentes |
| YAML do workflow e `git diff --check` | PASS |
| GitHub Actions via `gh run list` e diagnóstico `curl` | CONNECT 403 no proxy de `api.github.com`; estado remoto dos novos commits **não confirmado**, nenhum workflow disparado |

O typecheck identificou dois parâmetros CAS nullable incompatíveis com o schema não nulo; corrigidos somente os tipos. Depois do build, o cache `.next/dev` herdado de main conflitava com tipos da candidata. Esse cache gerado foi preservado em `/tmp`, e o typecheck final passou com os arquivos rastreados intactos. A alteração automática de `next-env.d.ts` pelo Next foi restaurada; nenhum erro de fonte foi escondido por configuração.

## Widget — falha crítica transversal comprovada

O teste executa o handler real com Prisma/PostgreSQL. Depois de o POST remoto retornar sucesso, um escritor concorrente substitui `Organization.settings` sem a reserva. A confirmação e a gravação de erro por CAS falham corretamente para não sobrescrever dados atuais, mas a referência da operação é perdida. Uma nova chamada emite outro POST: **2 em vez de 1**. A asserção permanece falhando como TODO explícito, com barreira de aceite bloqueante no workflow preparado. Isso não é teste aprovado nem reconciliação concluída.

A correção segura aplicada ao Widget saneia erros brutos Chatwoot em respostas e preserva os códigos/status locais. Reserva pré-POST, timeout com reconciliation_required, 404 sem criação substituta e conflito de agentes foram testados. Não foi implementada adoção por nome, desbloqueio por idade ou retry cego. A solução completa requer identidade de operação independente de settings, correlação verificável no provider e fluxo de reconciliação autorizado/testado. Ver `BLOCK2_WIDGET_LOCAL_VALIDATION_2026-10-20.md`.

## Migration local e rollback

Aplicadas somente `0_baseline`, `20260321000000_add_deleted_at_organizations`, `20260902000000_add_public_booking` e a nova `20261020230000_instagram_security_storage`. Esta última foi preparada e aplicada apenas localmente após a autorização explícita do usuário. Não foram alteradas migrations históricas nem usados migrate deploy/dev ou npm start.

As duas migrations MDS de seed/reassign continuam não executadas e não foram marcadas artificialmente como aplicadas. A dívida do histórico que omite outros campos/tabelas continua aberta; a reconciliação de schema feita em onboarding é exclusiva do banco descartável e não é um plano de migração de produção. Ao final, zero organizações de teste e zero registros das novas tabelas permaneceram no banco.

Rollback proposto nos relatórios de Widget, autenticação e G4: reverter os commits específicos somente com os fluxos afetados bloqueados, pois voltar ao comportamento anterior reabre as vulnerabilidades. Preservar tabelas/recibos/evidências; não apagar pending/remote_unknown ou liberar replay. A migration é aditiva e tabelas podem permanecer sem uso durante recuo de código; remoção exige decisão própria e backup. Não houve rollback real em produção nem aprovação desse plano para execução.

Como as validações não passaram integralmente, nenhuma publicação foi preparada para execução e nenhuma URL externa de destino foi presumida. Destino, versão anterior, backups e ensaio de rollback devem ser apresentados ao responsável antes de qualquer autorização futura.

## Git, credenciais e configuração

Nenhum `.env` ou segredo local foi incluído nos commits. `.env.local` e `.cache` estão ignorados; os segredos técnicos locais foram gerados sem imprimir valores. `.env.backup` **já estava rastreado** e contém campos que exigem revisão segura e rotação se forem reais. Não foram usados para acesso externo nem apagados silenciosamente; não se certifica ausência de credenciais históricas no repositório.

O core operacional de Atendimento/iframe, credenciais globais Chatwoot, adapters e demais lifecycle, política comercial, checkLimits e lockfile permanecem iguais à base candidata. A alteração pontual no guard legado foi necessária para impedir elevação por claim antigo, tem reprodução antes/depois e teste que preserva todos os demais bytes do arquivo. O processamento comercial Asaas está pinado por teste separado. Os doze documentos canônicos foram preservados e suas verificações passaram.

`install_script` e `start_skill` foram atualizados no rascunho e a instalação foi repetida. `api.github.com` foi adicionado às três regras customizadas existentes, preservando os presets, somente no rascunho; é necessário revisar/salvar essa liberação para retestar leitura do CI. Isso não foi aplicado/publicado nem comprova autorização REST. Não foi solicitado token apenas porque a CLI falhou. Sem publicação, não há evidência de restauração em uma nova tarefa. Os commits são locais e não foram enviados ao remoto.

## Commits locais e evidências

- `617cfd3` — saneamento de erros Widget e provas de conflito com PostgreSQL.
- `48c4190` — storage OAuth/webhook Instagram e migration para revisão/teste local.
- `d7ddde3` — tipos corretos dos snapshots CAS do Widget.
- `fdbdb5c` — papel atual do banco, autenticação Asaas, lint compatível, regressões e workflow preparado.
- O commit deste relatório é adicional; a lista completa com SHAs está no artefato `COMMITS.txt` e em `git log cb1884e..HEAD`.

Evidências: `/workspace/mds-crm-onboarding-evidence/candidate/`. Incluem logs de testes e build/typecheck, JSON de lint/auditoria, inventários originais e por método, TAP da falha conhecida e barreira bloqueante, reprodução de papel antigo e Asaas antes das correções, smoke HTTP, migrations e instalação repetida. Os testes com providers usam mocks explicitamente e não demonstram compatibilidade com uma instalação real.

Bloqueios para a próxima etapa: corrigir/reconciliar o Widget sem duplicação; revisar integralmente G2 e cenários restantes G1/G3; definir operação/retensão/reconciliação dos recibos G4; tratar lint/dependências e credenciais históricas; confirmar CI no SHA final; obter revisão independente e aceite formal. Não ativar enforce, não usar produção e não promover o candidato enquanto esses bloqueios estiverem abertos.

---

## Adendo — correção dos bloqueadores de homologação, 20/10/2026

Este adendo atualiza os resultados acima sem apagar a evidência histórica. **Decisão atual: NÃO HOMOLOGADO; nenhum gate aprovado formalmente.** Branch `audit/block2-closure`, mesmo checkout isolado. Os cinco commits originais de 617cfd3 a d541622 permanecem ancestrais, sem reescrita. Nenhum merge, push, deploy, publicação ou acesso a banco de produção foi realizado.

### Correções e comparação

| Item | Antes (d541622) | Resultado desta rodada |
| --- | --- | --- |
| Widget, perda da reserva | Dois POSTs; TODO de segurança executado e falhando | Operação persistente independente dos settings; recuperação por ID com GET/PATCH; 16 testes funcionais PASS, zero TODO, incluindo a asserção original |
| Auditoria npm | 49 dependências, 2 críticas | 17 dependências, **zero críticas**, 14 altas, 2 moderadas, 1 baixa |
| Versões efetivas do lock | next 16.2.6; next-auth 4.24.14 | next **16.3.8**; next-auth **4.24.15**, somente essas duas dependências diretas selecionadas |
| Lint global | 218 erros / 77 avisos | **182 erros / 77 avisos**, retorno 1; 36 erros corrigidos, nenhum diagnóstico novo |
| Identidade removida em auth/me | HTTP 200 reproduzido | Seis rotas pessoais usam associação ativa de checkAuth; 54 combinações negativas e 18 legítimas passaram em dois testes agrupados |
| Inventário de autorização | 177 métodos com sinais heurísticos | Todos os 177 métodos classificados por contrato/guard/exceção, 116 arquivos e 50 páginas/layouts; isso não prova todos os ramos nem substitui revisão independente |
| Suite Node/PostgreSQL | 89 PASS e 1 TODO falhando | **101 PASS**, zero falha/skip/TODO |
| Suite TypeScript | 171 PASS | **171 PASS**, zero falha/skip/TODO |
| Aceite equivalente ao workflow | Bloqueado pelo TODO | Barreira específica de TODO passou; CI remoto do novo SHA continua não executado |

Widget: a tabela aditiva WidgetInboxOperation vincula tenant, ConnectedAccount, conta/URL e identidade remota. Ela é reservada antes de enviar, e o ID remoto é salvo antes do CAS final. Foram auditados 27 pontos de escrita de Organization em 16 arquivos. Substituição do JSON não autoriza novo POST. Timeout/crash sem ID deixa pending/remote_unknown e exige reconciliação operacional; não existe adoção por nome, desbloqueio por idade ou criação substituta após 404. Testes reais de handler e PostgreSQL cobrem concorrência, conflitos CAS antes/depois do despacho, nova conexão de banco, PATCH existente, soft delete em momentos distintos, erro saneado e isolamento. Provider e transporte de autenticação nesses testes são simulados; Chatwoot real ainda não foi homologado. Detalhes e limites: [reconciliação durável](BLOCK2_WIDGET_DURABLE_RECONCILIATION_2026-10-20.md).

Dependências: os dois alertas críticos eram de Next e NextAuth diretos; a cadeia peer Next → NextAuth também propaga severidade. Versões corrigidas, ranges, GHSA, impacto condicionado à configuração e integridade constam em [dependências críticas](BLOCK2_CRITICAL_DEPENDENCIES_2026-10-20.md). Não foi explorado RCE. O teste isolado com o pacote oficial anterior reproduziu URIError para Bearer malformado; a versão corrigida retorna null. A aplicação usa CredentialsProvider, não EmailProvider; o aviso crítico de normalização de e-mail não foi descrito como fluxo local explorável. Next 16.3.8 cobre os ranges críticos e demais avisos do pacote sem escolher automaticamente a versão mais nova. Mudanças transitivas/plataforma no lock decorrem dessa seleção, não de audit fix global. As 17 dependências remanescentes continuam dívida explícita.

Lint: todos os 295 diagnósticos iniciais foram comparados por âncora de código com cb1884e e d541622; já estavam no candidato anterior aos cinco commits. Origem é classificação textual, não certificação semântica. Relevância para segurança é eixo separado: 53 diagnósticos iniciais em APIs/helpers sensíveis, dos quais restam 44 para revisão, sem presumir 44 vulnerabilidades. Foram corrigidos os erros do incremento e os bloqueadores diretamente alterados: tipos NextAuth/Instagram/notificações, const de signup, nomes locais de module, testes ESM mantendo asserções e carregamento inicial do Widget com cancelamento. As demais 259 mensagens (182 erros, 77 avisos) são preexistentes; nenhuma regra foi desativada. Detalhes: [G2 e lint](BLOCK2_G2_LINT_REVIEW_2026-10-20.md); classificação individual em lint-classification.json.

### Comandos executados e evidência final

Diretório externo de evidências: `/workspace/mds-crm-onboarding-evidence/blockers/`. Somente variáveis locais carregadas; BLOCK2_TEST_DATABASE_URL aponta ao mesmo PostgreSQL descartável. Logs não contêm valores de credenciais. Resultados intermediários falhos foram preservados, e os arquivos com sufixo final ou followup identificam as verificações conclusivas.

| Comando/verificação | Resultado e artefato |
| --- | --- |
| HEAD HTTPS da raiz de binaries.prisma.sh | TLS/conectividade responderam; raiz retorna 404, não é endpoint de engine (prisma-connectivity.log) |
| `curl --head --fail` do checksum oficial da engine Prisma fixada | HTTP 200, status 0; prisma-engine-connectivity.log |
| `npm install --save-exact next@16.3.8 next-auth@4.24.15` | PASS; dependency-install.log, metadados oficiais e dependency-changes.json |
| `npm ci --cache /workspace/.npm-cache` | PASS, lock reproduzido, 502 pacotes, validação TLS/integridade preservada; npm-ci.log e setup-repeat-final.log |
| `bash .cache/install-cloud.sh` atualizado e repetido | PASS, Prisma Client 5.22.0 gerado e diff de schema vazio; setup-repeat-final.log |
| `npx prisma validate` | PASS; prisma-validate.log |
| `npx prisma migrate status` | Retorno 1 esperado: somente as duas migrations históricas MDS de dados continuam pendentes; migrate-status.log |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | 101 PASS; node-tests-final.tap; barreira de zero TODO em todo-gate-final.log |
| `npx tsx --test tests/*.test.ts` | 171 PASS; tsx-tests-final.log |
| `node --import tsx --test tests/block2-personal-routes-postgres.test.mjs` após ajuste de tipo | 2 PASS (72 combinações); personal-routes-followup.tap |
| `npm run lint -- --output-file .../lint-after.json --format json` | Retorno 1: 182 erros e 77 avisos; lint-after.json e classificação por diagnóstico |
| ESLint nos 25 arquivos JS/TS existentes alterados desde d541622 | PASS; changed-files-lint.log; configuração/regras intactas |
| `npm run build` após ajustes finais | PASS, Next 16.3.8; build-final.log |
| `npx tsc --noEmit` após o build | PASS; typecheck-final.log; alteração gerada de next-env.d.ts restaurada |
| Reinício via `NEXTAUTH_URL` local + `npx next start --hostname 127.0.0.1 --port 3100` | Build atualizado servindo; server.log; sem usar prestart/npm start |
| `node .cache/bloco02-smoke.cjs` | **22 PASS**, login real sem HTTP 500, tenants/IDOR/permissões/assignee e agenda concorrente; http-smoke.log e http-smoke-results.json |
| Consulta final de limpeza PostgreSQL | Zero organizações, OAuth states, webhook receipts e Widget operations de teste restantes |
| Auditoria dos caminhos adicionados e boundary protegido | Nenhum .env/helper local/chave privada novo; .env.local e .cache ignorados; core e política comercial intactos desde d541622; git-boundary-final.json |

O smoke repetido demonstra uma única reserva de agenda para oito solicitações, sete 409 e um 201. A autenticação passou no build atualizado com sessões reais por HTTP. Isso não certifica todos os browsers ou integração de e-mail real. Os nove testes G4 com banco real continuam incluídos nos 101: consumo único de state concorrente entre oito consumidores, callback real com Meta chamado uma vez, tenant/usuário/expiração, indisponibilidade do store, assinatura inválida, ausência de identidade, envio concorrente, replay após nova instância de cliente, resultado incerto e ID igual em tenants distintos. Nenhum teste de código-fonte foi usado isoladamente para declarar a correção do Widget ou persistência G4.

### Gates após as correções

| Gate | Evidência atual | Situação restante |
| --- | --- | --- |
| G1 | Login HTTP real, testes de admin, reset, sessão, tokens e concorrência; regressão Bearer malformado corrigida | Validação local positiva; **não aprovado**. Revisão independente, browser/middleware e e-mail real pendentes |
| G2 | Revisão por método concluída no inventário; seis rotas pessoais corrigidas e matriz PostgreSQL positiva | **Não aprovado**. Verificação independente de ramos/ações indiretas, contratos públicos e exceções de produto pendente |
| G3 | Correção durável do Widget, 16 testes funcionais, isolamento entre tenants e bindings | **Não aprovado**. Chatwoot/Evolution e demais providers reais isolados, reconciliação operacional de resultado sem ID e revisão de referências legadas pendentes |
| G4 | Nove testes funcionais de persistência, assinatura, replay e concorrência no PostgreSQL local; 101 testes gerais positivos | **Não aprovado**. Validação Meta real e processo operacional de pending/remote_unknown, retenção/limpeza e revisão independente pendentes |
| G5 | observe_only preservado; APPROVED_ENFORCEMENTS vazio; suites de boundary/compatibilidade positivas | **Não aprovado formalmente**. Nenhum enforcement comercial foi autorizado ou ativado |
| G6 | Instalação repetível, schema local coerente, typecheck/build/smoke/suites positivos, relatório atualizado | **Bloqueado** pelo lint global, 17 dependências sinalizadas, ausência de CI remoto no novo SHA/revisão independente/providers reais e aceite de rollout/rollback |

Persistência: cinco migrations selecionadas estão aplicadas localmente, incluindo a nova `20261020234500_widget_durable_operation`. As duas de dados MDS continuam pendentes e não foram marcadas como aplicadas. Nenhuma migration histórica foi editada. A reconciliação extra de schema feita no onboarding continua exclusiva deste banco descartável; não converte o histórico em plano de produção.

Git/segredos: não foram adicionadas credenciais nem arquivos de configuração local. `.env.backup` já estava rastreado antes desta rodada: permanece risco anterior, exigindo revisão/rotação segura se contiver material real. Valores não foram expostos nem utilizados. O aviso Next sobre images.domains legado permanece registrado no startup; configuração de imagens/restrição de destinos exige revisão antes do rollout, fora desta correção pontual.

### Commits e reversão para revisão

Incrementos locais preservando os cinco originais: `c772fbb` (identidade durável Widget), `23f158e` (dependências críticas), `8ed774c` (G2 e lint). O commit que contém este adendo conclui os dois ajustes focados de lint e a documentação; seu SHA deve ser lido com `git log -1`, evitando referência circular dentro do próprio commit.

Rollback proposto, não executado: suspender provisionamento e fluxos afetados antes de reverter incrementos; preservar IDs, operações e recibos duráveis, inclusive estados incertos; não apagar tabelas nem permitir replay para destravar. Reverter as dependências restaura ranges vulneráveis, e reverter G2 volta a aceitar identidades removidas: qualquer recuo exige restrição dessas superfícies e revisão de segurança. Antes de futuro rollout, identificar versão/artefato anterior, destino, backup e restauração, ensaiar em ambiente isolado e submeter o plano ao responsável. A migration aditiva pode permanecer durante recuo de código. Não há autorização para executar rollback ou migrations em produção.

O rascunho reutilizável de onboarding foi atualizado com a quinta migration, comandos de teste ESM e estado final; salvar rascunho não publica nem aplica configuração. Os commits permanecem locais e não tiveram restauração em nova tarefa certificada. Como todos os gates ainda não passaram, não foi preparada publicação nem inventada URL de destino. Não é solicitada aprovação de deploy nesta etapa.

---

## Adendo — preparação da revisão independente, 20/10/2026

**Candidato funcional reavaliado:** `3f4ef1bfeb60a104e4e17e116462d24f301a3050`, branch `audit/block2-closure`. Os nove commits acumulados foram revisados e preservados. O novo incremento desta rodada contém somente preparação de eventos CI de PR, documentação e evidência sanitizada; não muda lógica da aplicação, dependências, schema ou migrations. Seu HEAD é o commit que contém este adendo (`git log -1`), sem referência circular no próprio conteúdo. **Nenhum gate aprovado; push/PR bloqueados pela verificação histórica de segredos.**

### Escopo dos nove commits

| Commit | Escopo revisado e vínculo com o Bloco 02 |
| --- | --- |
| 617cfd3 | Saneamento de erro Chatwoot e testes PostgreSQL do Widget; G3 |
| 48c4190 | Nonce OAuth de uso único e recibos de webhook Instagram, modelos/migration aditivos e testes; G4 |
| d7ddde3 | Tipos não nulos do CAS Widget, sem mudar regra de negócio; G3/G6 |
| fdbdb5c | Papel atual do banco, webhook Asaas fail-closed, ESLint compatível, testes e evidências G1–G4 |
| d541622 | Relatório consolidado e bloqueios G1–G6 |
| c772fbb | Operação durável Widget independente de settings, vínculos de provider, migration aditiva e testes; G3 |
| 23f158e | Atualização pontual Next/NextAuth e regressão do Bearer malformado; G1/G6 |
| 8ed774c | Associação ativa em seis rotas pessoais, tipos/lint e testes ESM com asserções preservadas; G2/G6 |
| 3f4ef1b | Fechamento de dois erros focados de lint e relatório de resultados; G6 |

Revisão dos patches: 52 arquivos no incremento dos nove, sem feature comercial adicional ou refatoração global. As duas migrations adicionam somente tabelas/índices/FKs de storage de segurança. Históricas não foram editadas. A alteração de checkPermission é o endurecimento documentado do papel atual no banco, já autorizado e testado; não é ativação de enforcement. Demais políticas/core protegido não foram ampliados. Exceções do teste de boundary admitem apenas novos modelos/relações/helpers autorizados. Helpers, fixtures e credenciais CI são técnicos/fictícios; não foi usado banco de produção.

### Verificação do histórico e bloqueio de envio

`git ls-remote origin refs/heads/audit/block2-closure refs/heads/feature/modular-plans-entitlements` confirmou base **cb1884e413203baa123ca94dfb0a4c4635b6502a** e ausência da ref audit remota. Nenhuma divergência detectada; verificar de novo antes de qualquer futuro push. API GitHub autenticada acessível nesta rodada (o CONNECT403 anterior é histórico, não bloqueio atual). Nenhuma ref foi enviada/modificada no GitHub.

**Não é possível confirmar o item “ausência de credenciais, .env e temporários no histórico”.** `.env.backup`, introduzido em dfdf0a5 antes dos nove commits, contém DATABASE_URL com senha, NEXTAUTH_SECRET, TOKENS_SECRET e META_APP_SECRET não-placeholder. Validade externa não foi testada; tratar como candidatos sensíveis até confirmação de revogação/rotação pelo responsável. Campos de API Chatwoot/Gemini desse arquivo são placeholders em português e não foram contados como vazamentos comprovados. `.env.example` é template, não arquivo local adicionado pelo incremento.

Varredura de 1.576 blobs alcançáveis: correspondências dos quatro candidatos acima apenas no blob antigo de .env.backup; zero novas correspondências desses valores e zero novos padrões de chave privada/token GitHub/Google/AWS nos objetos dos nove commits. Nenhum caminho .env, dump, chave, log ou helper temporário foi adicionado pelos nove. Isso é scanner heurístico + comparação exata, não prova universal de ausência de segredos/PII/dados de produção. No histórico anterior também há build.log e src/app/(app)/leads/page.tsx.backup; não atribuir sua inclusão aos nove. Não foi identificado dump de produção novo; a ausência absoluta de dados de produção no histórico não foi certificada. Nomes/blobs e metadados, sem valores, constam de history-audit.json/env-history-metadata.json fora do Git.

O primeiro push foi interrompido preventivamente por falha dessa condição de segurança, não por divergência remota ou rejeição de aprovação automática. Não se removeu arquivo histórico nem se reescreveram commits: exclusão no HEAD não limpa ancestrais. Saneamento real exige decisão separada, coordenação de refs/colaboradores e rotação quando aplicável; não é autorizado implicitamente pela solicitação de PR. Plano e texto da PR estão em [preparação da PR Draft](BLOCK2_DRAFT_PR_REVIEW_REQUEST_2026-10-20.md).

### Verificações repetidas, sem produção

Evidências atuais: `/workspace/mds-crm-onboarding-evidence/independent/`. O HEAD funcional acima é o alvo dos testes; as mudanças posteriores são documentação/evidência e gatilhos CI, com YAML validado e regressão de segurança repetida. Node local é 24; workflows usam 22, ainda não executados neste SHA. Não confundir equivalência de comandos com CI GitHub aprovada.

| Verificação | Resultado real |
| --- | --- |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs`, DB local explícito | **101 PASS**, zero fail/skip/TODO; node-tests.tap |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, zero fail/skip/TODO; tsx-tests.log |
| `npm run build` | PASS; build.log |
| `npx tsc --noEmit` após o build, alteração gerada next-env.d.ts restaurada | PASS; typecheck.log |
| `npx prisma validate` e migrate diff schema local `--exit-code` | PASS, diff vazio; prisma-validate.log/prisma-diff.log; nenhuma migration executada nesta rodada |
| Reinício do build por `npx next start` sem prestart; smoke HTTP real | **22 PASS**, incluindo login, tenants, IDOR, restrição de papel, rate limit e agenda concorrente; http-smoke-results.json |
| `npm run lint -- --output-file .../lint.json --format json` | Retorno1, **182 erros/77 avisos**; zero diagnósticos novos por âncora de código contra cb1884e |
| Auditoria atual `npm audit --json` | Retorno1, **46 pacotes: 0 críticos,40 altos,3 moderados,3 baixos**; npm-audit.json |
| Auditoria da base, mesmo momento, lock isolado fora do checkout (`--package-lock-only --ignore-scripts`) | Retorno1, **49 pacotes: 2 críticos,37 altos,8 moderados,2 baixos**; npm-audit-base-current.json |
| YAML dos quatro workflows e permissões | PASS; pull_request somente contra feature/modular-plans-entitlements, contents:read, sem pull_request_target, jobs de teste existentes preservados |
| `npm run test:security` após preparar gatilhos | **12 PASS**; security-workflow-followup.log; não substitui suites funcionais |
| Boundary/inventário de autorização após preparar gatilhos | PASS; boundary-followup.log; controles protegidos preservados |
| Limpeza final PostgreSQL | Zero organizations/OAuth states/receipts/Widget operations; database-cleanup.log |

O resultado atual **46 substitui o agregado17 anterior para esta execução**;17 permanece evidência histórica. O lock não foi alterado nesta rodada. A agregação npm inclui metavulnerabilidades propagadas; não foi presumida publicação de29 advisories novos. Comparação pareada atual: nenhum pacote sinalizado novo e nenhuma URL de advisory direto nova; nanoid/sharp/uuid deixaram a lista. Os 17 pacotes históricos têm versões idênticas às da base. Next/NextAuth/PostCSS alterados anteriormente mantêm riscos herdados, já existentes. Não se afirmou que todo aviso restante é inalcançável ou que ausência de pacote novo prove ausência de regressão funcional.

A [classificação de riscos](BLOCK2_INDEPENDENT_RISK_REGISTER_2026-10-20.md) detalha os182 erros e77 avisos por regra, os17 pacotes históricos por versão/cadeia/impacto, e o agregado atual. [Registro sanitizado por diagnóstico e pacote](evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json) permite revisão sem depender de helpers ignorados. Todos259 diagnósticos restantes já têm âncora no candidato original;44 estão em fronteiras sensíveis, prioridade de revisão, não44 vulnerabilidades comprovadas. Nenhuma atualização em massa ou exceção de lint foi feita.

### GitHub Actions e revisão independente

Consulta real à API: C03-C04 Security Regression da **base cb1884e** terminou success, run [39364369568](https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/runs/39364369568). Runs anteriores de outros SHAs incluem falhas; não foram atribuídas ao HEAD atual. A branch audit retornou **zero runs**. Não houve workflow_dispatch, porque a branch/commit não foi enviado. Não existe aprovação CI do HEAD local.

Os quatro workflows existentes antes desta rodada só disparavam em push da branch feature ou manualmente. Foram preparados eventos pull_request contra a base, sem segredos reais, escrita de conteúdo ou jobs de deploy. Abrir Draft PR futuramente deverá permitir os jobs de autorização, handlers/PostgreSQL, C03-C04 e build, sujeito às políticas/ativação do GitHub. Nada foi disparado agora nem descrito como verde.

**Pedido formal de revisão ainda não enviado.** A API de colaboradores retornou somente mundodigitalsolucoes, a própria conta autenticada, e não há CODEOWNERS rastreado. Nenhuma pessoa distinta foi identificada para solicitar review, e não se tentou autoaprovação. O texto com escopo G1–G6 e prioridades está pronto no documento de PR; é necessário indicar reviewer/time independente com acesso após tratar o bloqueio histórico. Não foram criados issue, e-mail ou mensagem externa alternativos.

| Gate | Atualização nesta rodada | Estado |
| --- | --- | --- |
| G1 | Suites de autenticação/tokens e login HTTP repetidos positivos | Sem aprovação formal; browser/e-mail e revisão independente pendentes |
| G2 | Patches dos guards e classificação de métodos/riscos revisados; regressões positivas | Sem aprovação formal; revisão independente de caminhos indiretos/exceções pendente |
| G3 | 16 casos Widget funcionais incluídos na suite positiva, isolamento e vínculos preservados | Sem aprovação; providers reais e procedimento de resultado remoto incerto pendentes |
| G4 | Nove casos funcionais PostgreSQL de state/assinatura/replay repetidos positivos | Sem aprovação; Meta real, retenção/reconciliação operacional e revisão independente pendentes |
| G5 | Sem alteração de observe_only ou APPROVED_ENFORCEMENTS vazio | Sem aprovação formal; nenhum enforcement ativado |
| G6 | Revisão dos nove, build/typecheck/testes e pacote de revisão local concluídos | **Bloqueado** por histórico sensível/artefatos antigos, lint global,46 pacotes sinalizados, ausência de CI deste SHA e reviewer independente |

Não houve merge, push, deploy, publicação ou migrations em produção; nem alteração de serviços/credenciais reais. Para prosseguir no GitHub, o responsável deve decidir tratamento de `.env.backup` histórico e confirmar rotação/revogação quando aplicável, além de indicar revisor distinto. Sem essa decisão, não se afirma condição satisfatória para o envio condicionado. A verificação remota deverá ser repetida imediatamente antes do primeiro push e qualquer divergência interromperá o envio.

---

## Adendo — retomada autorizada e candidata saneada, 20/10/2026 (America/Sao_Paulo)

**Decisão: candidata preparada para revisão local, Bloco 02 ainda NÃO HOMOLOGADO. Nenhum gate formalmente aprovado.** O responsável confirmou que `.env.backup` foi criado intencionalmente para testes e que os valores atuais conferidos no Coolify são diferentes ou ausentes. Essa informação permite continuar a homologação sem rotação indiscriminada de produção. Não é prova técnica de que valores antigos estejam revogados em todos os serviços. Nenhuma alteração de credenciais/Coolify/produção foi feita.

### Preservação, credenciais e saneamento

`audit/block2-closure` permanece exatamente em **59da966edfcc627c074b8c47a8bb50c314ad90a3**, conservando todos os commits originais. A nova ref local **audit/block2-sanitized** contém a linhagem filtrada. Base local saneada: **8aa1db0b893b042967c3905a3582916b713cf9ab**, ref `audit/block2-sanitized-base`. Código/testes verificados: **cf45f38edbef8c475c90d801b0d75423b1e1499d**; o commit deste adendo acrescenta apenas documentação/evidências. HEAD final é identificado por `git log -1` e execution-record.json, sem referência circular.

Git-filter-repo2.47.0 foi executado somente sobre a ref candidata, sem reescrever branches remotas ou a auditoria original. Foram eliminados dos ancestrais da candidata `.env.backup`, `build.log` e o backup antigo de leads. Conferidas **783 correspondências de árvore**: no passo de filtragem, a única diferença era esses três caminhos. As dez correções/documentações originais possuem equivalentes com mesmo conteúdo funcional. [Mapa de linhagem](evidence/BLOCK2_SANITIZED_LINEAGE_2026-10-20.json). SHAs ancestrais mudaram; dois baselines nos testes foram remapeados para commits de conteúdo equivalente e todas as asserções foram mantidas. Não houve alteração de core, contratos comerciais, lock, schema ou migrations nesta retomada. A correção nova do Widget abaixo é a única alteração funcional adicional.

A varredura da linhagem candidata não encontrou os quatro valores expostos nem padrões de chave privada/GitHub/Google/AWS. `.env.example` permanece como template. Não se certificou ausência universal de segredo de formato desconhecido ou PII. As refs antigas continuam intencionalmente no repositório local e o histórico público permanece inalterado: **não enviar --all, --mirror, tags ou a branch antiga**.

Comparação por HMAC efêmero, com chave e impressões digitais somente em memória, inclusive busca de coincidências em outros nomes de variáveis locais: DATABASE_URL/NEXTAUTH_SECRET/TOKENS_SECRET diferentes; chave AES efetiva também diferente; META_APP_SECRET ausente; nenhuma coincidência nas configurações locais disponíveis. O nome operacional Instagram no código é META_INSTAGRAM_APP_SECRET, que também deve ser considerado na verificação manual de ambientes. Coolify/providers não estão vinculados às ferramentas desta sessão; nenhuma sondagem com as credenciais antigas foi feita. **Validade em serviços externos não acessíveis: indeterminada.** Não foi declarada atividade nem revogação global sem prova. Declaração do responsável e comparações são registradas separadamente no [resumo sanitizado](evidence/BLOCK2_SANITIZED_VALIDATION_2026-10-20.json).

### Corrida do Widget reproduzida e corrigida

A primeira reexecução completa registrou **100 PASS/1 FAIL**. O perdedor da reserva durável podia persistir erro no JSON ainda original antes do CAS do criador, impedindo a criação (zero POST em vez de um). Não foi observada duplicação nesse caso, mas era falha de disponibilidade do mesmo fluxo do Bloco 02. O novo teste determinístico pausa o criador antes do CAS, executa o perdedor e comprova a invalidação antes da correção.

Correção mínima em ae77a5d: resposta WIDGET_INBOX_RECONCILIATION_REQUIRED sem posse da reserva não persiste erro nos settings compartilhados. Reserva durável, autorização, identidade remota e bloqueio de resultado incerto permanecem. O teste exige HTTP409 do perdedor, snapshot intacto, HTTP200 do criador e exatamente um POST; **17 testes funcionais Widget passaram**. Nenhuma asserção/TODO foi removida.

Uma segunda execução teve **101 PASS/1 FAIL** somente por regex estática que exigia indentação de seis espaços em expectedSettings. cf45f38 passou a conferir o argumento dentro da chamada persistRuntimeError independentemente da indentação; preserva a condição CAS e não relaxa controle de acesso. O resultado final é **102 PASS**, zero falha/skip/TODO. Logs das duas falhas foram mantidos em resumption/node-tests.tap, widget-race-before.log e node-tests-source-assert-before.tap, separados do resultado final.

### Verificações finais nesta candidata

Artefatos: `/workspace/mds-crm-onboarding-evidence/resumption/`. Código/testes correspondem a cf45f38; documentação/evidências posteriores não alteram runtime. Segredos e hashes de segredos não foram colocados em Git, documentos ou logs. Somente PostgreSQL descartável loopback mds_crm_dev e providers simulados nos testes de handlers. Smoke usa sessões HTTP reais com dados fictícios.

| Comando/verificação | Resultado real e evidência |
| --- | --- |
| `node --import tsx --test --test-reporter=tap tests/*.test.mjs` | **102 PASS**, zero fail/skip/TODO; node-tests-final.tap |
| `npx tsx --test tests/*.test.ts` | **171 PASS**, zero fail/skip/TODO; tsx-tests-final.log |
| Suite funcional Widget isolada | **17 PASS**; widget-race-after.log; novo caso determinístico falhou antes |
| `npm run build` após correção funcional | PASS Next16.3.8; build-final.log |
| `npx tsc --noEmit` após build | PASS; typecheck-final.log; next-env.d.ts gerado restaurado |
| Prisma validate e migrate diff local `--exit-code` | PASS, diff vazio; prisma-validate.log/prisma-diff.log; nenhuma migration aplicada nesta rodada |
| `npx prisma migrate status` | Retorno1 esperado pelas duas migrations MDS históricas de dados ainda pendentes; migrate-status.log |
| `npx next start`, sem npm start/prestart, e smoke autenticado | **22 PASS**, login sem500, IDOR/tenant/assignee/permissão, rate limit e um201/sete409 na agenda concorrente; http-smoke-results.json |
| ESLint dos quatro arquivos de código/teste alterados no saneamento/correção | PASS; scoped-lint-final.log |
| `npm run lint -- --output-file .../lint.json --format json` | Retorno1, **182 erros/77 avisos**, nenhum diagnóstico novo por âncora; lint.json |
| `npm audit --json` | Retorno1, **46 pacotes:0 críticos/40 altos/3 moderados/3 baixos**; npm-audit.json |
| Auditoria repetida do lock original, fora do checkout, `--package-lock-only --ignore-scripts` | Retorno1,49 pacotes/2 críticos; npm-audit-base-current.json; nenhum pacote sinalizado novo na candidata |
| Revisão G2 por método repetida |116 arquivos,177 métodos,50 páginas/layouts,zero não classificados; g2-review.json; revisão estática não prova todos os ramos |
| Quatro workflows YAML | PASS, permissões read-only e gatilhos PR preservados; nenhum job remoto executado |
| Bundle de candidata/base importado em bare separado, sem objetos compartilhados | PASS: baselines saneados disponíveis, objeto da auditoria antiga ausente, caminhos removidos e valores expostos não alcançáveis; standalone-bundle-check.json |
| Limpeza final PostgreSQL | Zero organizations/OAuth states/receipts/Widget operations de teste; database-cleanup.log |

O registro individual de **182 erros/77 avisos** e **46 pacotes** foi atualizado para a candidata saneada: [riscos](BLOCK2_INDEPENDENT_RISK_REGISTER_2026-10-20.md), [dados por diagnóstico/pacote](evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json). Continuam44 diagnósticos em fronteiras sensíveis, não44 vulnerabilidades comprovadas. Nenhuma regra desativada nem atualização em massa. O17 anterior permanece apenas snapshot histórico. Aviso images.domains legado permanece risco/configuração a revisar; nenhum exploit foi executado.

### G1–G6 e condições de aceite restantes

| Gate | Verificação concluída no escopo autorizado | Pendência para aceite formal |
| --- | --- | --- |
| G1 | Login HTTP real e suites de admin, sessões, reset/tokens/convites/concorrência positivos | Browser/e-mail reais e revisão independente; logout não certificado como revogação de JWT roubado |
| G2 | Revisão por método repetida; guards/papel atual e54 combinações negativas/18 legítimas de recursos pessoais positivos | Revisão independente de ramos/recursos indiretos e exceções públicas; classificação não é autorização de produto |
| G3 | Multi-tenant/providers simulados positivos;17 testes funcionais Widget, inclusive novo interleaving determinístico | Providers reais isolados, referências legadas e procedimento de resultado sem ID ainda sem homologação |
| G4 | Nove testes reais PostgreSQL de nonce, callback, assinatura, replay e isolamento incluídos na suite positiva | Meta real, retenção/limpeza e operação de pending/remote_unknown ainda sem aceite |
| G5 | Suites de entitlements/boundary positivas; observe_only e APPROVED_ENFORCEMENTS vazio confirmados | Aceite independente da matriz/legado; nenhum enforcement autorizado ou ativado |
| G6 | Candidata saneada portável, testes/typecheck/build/smoke e documentação concluídos localmente | Lint/dependências, reviewer independente, CI do SHA enviado e decisão de destino/base/promover continuam pendentes |

Nenhum gate foi marcado aprovado. As pendências externas não foram substituídas por testes de código-fonte ou pela confirmação do arquivo de testes. Não há acesso autorizado a providers reais isolados nesta sessão para certificar esses fluxos; nenhuma operação de produção foi tentada.

### Apresentação para autorização de envio — nada enviado

Candidata **audit/block2-sanitized**, base local **audit/block2-sanitized-base**. Bundle local inclui exclusivamente essas duas refs, não a auditoria antiga. O SHA final está no commit deste relatório e execution-record.json. A base remota feature/modular-plans-entitlements foi novamente consultada e continua em cb1884e; nenhuma branch audit remota foi encontrada. Nenhuma divergência remota foi incorporada ou resolvida automaticamente.

**Uma PR direta contra a base pública não saneada não é o plano proposto:** a reescrita muda o merge-base, mistura linhagens e não remove a exposição nas outras refs públicas. Para envio futuro, autorizar um destino isolado com ambas as refs saneadas ou um plano separado/coordenado de saneamento da base remota. Os quatro workflows ainda filtram PRs para feature/modular-plans-entitlements; se for escolhido outro nome de base, ajustar e validar o filtro antes do envio. Não criar repositório, alterar base remota ou enviar refs sem a nova autorização. Mesmo eventual envio da candidata não limpa sozinho histórico público/caches/PRs antigos.

Parecer solicitado a uma pessoa distinta deve revisar os artefatos desta candidata, casos críticos de reserva/timeout/replay/tenant, origem e alcance de lint/dependências, exceções públicas e rollback. A conta autenticada é o único colaborador conhecido; nenhum reviewer independente foi inventado, nenhum pedido remoto enviado e nenhuma autoaprovação emitida. CI da base cb1884e anteriormente verde não vale como CI desta candidata; **CI remota do SHA saneado: NÃO EXECUTADA**.

Rollback proposto para revisão, não executado: suspender o fluxo afetado antes de recuar, preservar identidades/recibos duráveis e nunca apagar pending/remote_unknown para liberar POST. Reverter a correção do perdedor da reserva reabre a falha de disponibilidade; reverter guard/dependência reabre riscos corrigidos. Tabelas aditivas devem permanecer durante eventual recuo; qualquer remoção depende de plano próprio/backup. Nenhum merge, push, deploy, migration em produção, alteração no Coolify ou enforcement comercial foi realizado.
