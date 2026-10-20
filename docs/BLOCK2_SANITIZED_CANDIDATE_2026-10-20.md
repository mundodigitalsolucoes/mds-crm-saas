# Bloco 02 — candidata local com histórico saneado

Branch de preservação: `audit/block2-closure` em `59da966edfcc627c074b8c47a8bb50c314ad90a3`, sem alteração. Branch candidata: `audit/block2-sanitized`. Base funcional original cb1884e corresponde à base saneada `8aa1db0b893b042967c3905a3582916b713cf9ab`, também disponível na ref local `audit/block2-sanitized-base`.

O responsável informou que o backup era intencionalmente de testes e que os valores atuais conferidos no Coolify são diferentes ou ausentes. Essa declaração é evidência do responsável, não leitura direta de produção por este agente. Não se exige rotação de produção sem correspondência comprovada. Não foram executadas rotações, sondagens autenticadas a providers ou alterações no Coolify. A validade dos valores antigos em serviços não acessíveis permanece indeterminada; diferença de configuração não prova revogação global.

Comparação local com HMAC-SHA256 e chave aleatória efêmera, sem valores/impressões digitais armazenados: DATABASE_URL, NEXTAUTH_SECRET e TOKENS_SECRET locais diferentes; chave AES efetiva de TOKENS_SECRET também diferente; META_APP_SECRET ausente. Nenhum valor exposto coincidiu com outras variáveis presentes nas configurações locais disponíveis. O aplicativo usa META_INSTAGRAM_APP_SECRET para Instagram: a revisão manual do provider deve considerar essa variável, além do nome legado META_APP_SECRET. Não há binding de Coolify/providers disponível para confirmar sua validade externa. Não foram usadas credenciais do backup para conectar a serviços. A confirmação de teste e a autorização do responsável permitem continuar homologação local, sem declarar credenciais antigas revogadas.

## Saneamento realizado

Usado git-filter-repo 2.47.0 apenas sobre refs/heads/audit/block2-sanitized, com filtragem parcial. Removidos de todos os ancestrais alcançáveis dessa ref: `.env.backup`, `build.log` e `src/app/(app)/leads/page.tsx.backup`. Verificadas 783 correspondências de commits: a árvore de cada commit mapeado difere da original somente por esses caminhos. As dez correções/documentações originais têm correspondentes preservados, conforme [mapa de linhagem](evidence/BLOCK2_SANITIZED_LINEAGE_2026-10-20.json). Mapa completo está fora do checkout em /workspace/mds-crm-onboarding-evidence/resumption/full-commit-map.txt.

Não se removeu `.env.example`, que é template; nenhum arquivo de produção foi alterado. No passo de filtragem, código funcional, lock, schema e migrations eram idênticos aos da auditoria preservada. Depois foram acrescentados ignore, atualização de dois SHAs de baseline em testes, documentação e uma correção mínima de corrida do Widget, descrita abaixo; lock/schema/migrations não mudaram. Os baselines apontam agora para os mesmos conteúdos na linhagem saneada; nenhuma asserção/guard foi desabilitada. Isso permite verificar os testes sem depender dos objetos antigos removidos de uma futura cópia saneada.

A varredura local cobre todos os blobs alcançáveis pela candidata, compara os quatro valores expostos e procura padrões de chaves privadas, GitHub, AWS e Google. Não registra segredos, chaves de comparação ou hashes de segredos. Ausência desses achados não é certificação universal de ausência de PII ou segredo de formato desconhecido. A branch original e outras refs locais conservam intencionalmente o histórico antigo; não publicar `--all`, `--mirror`, tags ou bundles dessas refs.

## Publicação futura exige decisão própria

Nenhum push, merge, rebase remoto, deploy ou migration de produção foi feito. O GitHub público continua com a linhagem anterior. Uma PR normal contra feature/modular-plans-entitlements não saneada usaria um merge-base anterior e não representa corretamente este incremento. A candidata deve ser revisada contra `audit/block2-sanitized-base`; esse diff corresponde ao Bloco 02, sem introduzir outra feature.

Para futuro envio autorizado, escolher explicitamente uma base remota saneada compatível e solicitar somente as refs saneadas. Se o objetivo for sanear o repositório público existente, é necessário plano separado para branches/tags/refs PR/cache e coordenação com colaboradores/GitHub; esse trabalho não foi executado. Não fazer force-push nem recriar base remota implicitamente. Uma nova branch saneada no mesmo repositório não remove o arquivo das refs públicas antigas. Um destino isolado pode permitir revisão sem anexar ancestrais antigos, mas sua criação/envio também exige autorização.

## Revisão independente e gates

Reexecutar testes funcionais PostgreSQL, suites de autorização/entitlements, typecheck, build, lint, auditoria npm, schema diff e smoke HTTP sem providers reais. Nunca usar npm start ou migrate deploy/dev, que aplicariam migrations indiscriminadamente. Banco permitido exclusivamente mds_crm_dev em loopback; duas migrations históricas MDS de dados permanecem pendentes. Preserve observe_only e APPROVED_ENFORCEMENTS vazio.

G1–G4 têm evidências locais funcionais, mas providers reais, browser/e-mail, revisão de caminhos indiretos e operação de estados incertos continuam sem aceite independente. G5 não autoriza enforcement. G6 depende de revisão por pessoa distinta, CI do SHA enviado, tratamento dos riscos restantes e decisão de promoção. A confirmação do backup de testes não aprova gates, não resolve lint/dependências e não autoriza envio ao GitHub.

O relatório oficial receberá o resultado da execução nesta candidata. Pedido de review e texto de PR anteriores são históricos; não enviar a antiga branch audit/block2-closure. Preparar pedido com esta ref saneada e o SHA final, somente após autorização de envio e indicação do responsável independente.

## Corrida funcional encontrada na reexecução

A primeira suite completa registrou100 PASS/1 FAIL: o concorrente perdedor podia gravar erro no snapshot original antes do CAS do dono da reserva, causando zero POST em vez de um. Isso é falha de disponibilidade, sem duplicação observada nesse caso. Novo teste determinístico pausa o dono antes do CAS, executa o perdedor e exige snapshot intacto, HTTP409 do perdedor, HTTP200 do dono e um único POST. Falhou antes da correção.

Correção mínima no catch do provisionamento: resposta de reconciliação sem posse da reserva não persiste erro nos settings. Não muda a reserva durável, o bloqueio de resultado incerto, os IDs ou a autorização. Suite Widget agora tem17 testes funcionais PASS; resultado inicial falho permanece como evidência em resumption/node-tests.tap e widget-race-before.log. O resultado final completo deve ser lido no relatório oficial. Nenhuma asserção foi removida.
