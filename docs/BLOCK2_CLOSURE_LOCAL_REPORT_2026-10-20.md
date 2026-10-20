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
