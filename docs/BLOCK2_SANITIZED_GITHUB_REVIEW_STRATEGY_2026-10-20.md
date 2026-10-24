# Estratégia para revisão no GitHub — somente proposta

**Fonte:**audit/block2-sanitized em f1975c9. Nenhum push, criação de ref/PR, alteração de configuração GitHub ou deploy foi realizado. A implementação desta estratégia requer autorização específica distinta da aprovação do plano de código.

## Destino recomendado

Usar o **mesmo repositório** mundodigitalsolucoes/mds-crm-saas, criando somente duas refs novas e saneadas:

| Papel | Ref remota proposta | Conteúdo |
| --- | --- | --- |
| Base de revisão | review/block2-sanitized-base |8aa1db0b893b042967c3905a3582916b713cf9ab, já saneada |
| Candidata | audit/block2-sanitized |SHA final aprovado, descendente da base saneada; inclui correções/evidências do Bloco02 |
| PR |Draft da candidata para review/block2-sanitized-base |Comparação somente da linhagem saneada; sem merge |

Não é outro CRM, repositório por cliente ou implantação paralela. Não substituir main, feature/modular-plans-entitlements ou audit/block2-closure. A base pública antiga continua em12e0e6735c4023ff4d2d947920703d30b3e252f0 e suas duas decisões documentais já estão na candidata por conteúdo. Não fazer merge/rebase/cherry-pick que una os ancestrais antigos à candidata.

Uma PR contra feature/modular-plans-entitlements usaria outra linhagem/merge-base. Ela não é necessária para revisão inicial e não limparia o histórico público. A mudança futura da branch de produção/base oficial é decisão separada. O envio dessas duas refs também não elimina arquivos de refs/caches/PRs públicos antigos; higiene histórica total e estado de credenciais continuam frentes separadas.

## Preflight verificável, antes de qualquer envio

1. Congelar SHA e diff aprovados; preferencialmente corrigir/retestar C0 antes do envio. Um Draft apenas para revisão com bloqueador conhecido deve identificá-lo expressamente e não receber rótulo de homologado.
2. Confirmar audit/block2-closure preservada em59da966, base saneada fixa8aa1db0 e ancestralidade da candidata. Comparar todas as mudanças funcionais e metadados dos dez commits originais mapeados.
3. Gerar bundle **somente** com candidata/base saneadas; nunca --all/--mirror/tags, cópia integral de .git ou diretório de trabalho. Clonar/importar em bare isolado sem alternates/objetos compartilhados e verificar paths removidos, baselines de testes e ausência dos objetos antigos59da966/c4cd327/12e0e67 como commits.
4. Executar scanner de segredos e inspeção de dados temporários sobre todos os commits/blobs alcançáveis do bundle, com resultados sanitizados. Lista de paths removidos sozinha não certifica todos os formatos/renomes. Não usar os valores antigos contra providers nem armazenar hashes de segredos.
5. Confirmar responsável independente com acesso. Hoje a API de colaboradores retorna só a própria conta autenticada; ela não pode cumprir G6 por autoaprovação. GitHub App/serviço sem reviewer distinto também não equivale a aceite humano.
6. Revisar os quatro workflows e integrações: somente testes/build, contents:read, sem secrets de produção, pull_request_target ou jobs de deploy. Confirmar com o responsável que a criação das refs não aciona publicação externa/Coolify; a documentação de deploy manual não prova sozinha a configuração atual dos webhooks/apps. Não alterar Coolify para executar este plano.
7. ls-remote das refs exatas e da base pública; comparar com os SHAs esperados. As duas refs de revisão foram consultadas nesta rodada e não existiam; base pública12e0e67. **Qualquer existência inesperada ou alteração por terceiro interrompe o envio.** Nova documentação remota deve ser avaliada por conteúdo, sem herdar histórico.

## Envio e CI, somente após autorização explícita

- Autorizar nominalmente repositório, duas refs, SHA base e SHA candidato. Usar criação atômica das duas refs com precondição remota de ausência, sem seguir tags e sem substituir refs existentes. Uma colisão deve falhar, não virar force-push/rebase ou atualização automática. Não executar comandos de push só porque constam de um plano.
- A ref pública antiga não participa dessa transação: revalidá-la imediatamente antes e depois. Se mudar entre as leituras, suspender PR/ações subsequentes e apresentar o conflito, sem rollback remoto automático ou eliminação de refs.
- Conferir SHA devolvido pelo GitHub; criar PR **Draft** contra review/block2-sanitized-base com problemas conhecidos, limites dos testes e plano de rollback. Pedir review à pessoa/time indicado; não usar a conta autora como independente.
- C6 deve adicionar o filtro da nova base nos quatro workflows. Hoje eles filtram PR somente para feature/modular-plans-entitlements: **uma PR na base proposta não garante CI automática com o código atual**. Não publicar uma mudança na base antiga/default apenas para contornar essa limitação.
- Jobs aplicáveis: Block2 Authorization Regression, PostgreSQL Handler/Concurrency, C03-C04 Security Regression e C03-C04 Build Validation. Instalação congelada, Node22, Prisma e PostgreSQL exclusivamente CI descartável; nunca npm start/prestart ou migrate deploy de produção.
- Registrar URLs/runs, SHA real do checkout (head ou merge-ref), base/head, status/falha/skip/TODO e logs. A CI da base antiga e os testes locais Node24 não equivalem à CI do SHA saneado. Se política do GitHub exigir habilitação/aprovação de workflow, registrar o bloqueio; não presumir success.
- Não fazer merge, deploy, habilitar enforcement nem alterar proteção/publicação. O Draft é para avaliação; nenhuma promoção está autorizada.

## Preservação e retirada

A auditoria antiga permanece local; a base saneada permite rastrear os commits pelo mapa sem republicar os seus ancestrais. Se o envio/CI falhar, conservar as evidências e refs de revisão até decisão do responsável; não apagar branches remotas ou alterar o histórico compartilhado automaticamente. Corrigir por novo commit pequeno quando autorizado, não por force-push.

Parecer de G6 deve registrar autor/revisor distintos, SHA revisado, bugs resolvidos/abertos, riscos de rollback e aceite explícito. O novo Dashboard P1, lint182/77,46 pacotes sinalizados e providers reais pendentes continuam condições de revisão, não são resolvidos pela publicação de uma PR.
