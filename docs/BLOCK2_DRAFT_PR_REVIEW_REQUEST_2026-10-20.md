# PR Draft histórica — revisão independente Bloco 02

**SUPERADA na retomada:** a candidata atual é audit/block2-sanitized, comparada a audit/block2-sanitized-base. Não enviar a branch antiga. Consulte BLOCK2_SANITIZED_CANDIDATE_2026-10-20.md e o último adendo do relatório. A declaração do responsável sobre o backup de testes substitui a necessidade presumida de rotação indiscriminada, sem certificar validade externa.

**Estado: somente texto local; PR não criada, nenhum push realizado.** O requisito de ausência de segredos/arquivos locais no histórico falhou por `.env.backup` preexistente. A preparação técnica não autoriza ignorar esse bloqueio.

Destino proposto: `mundodigitalsolucoes/mds-crm-saas`, head `audit/block2-closure`, base `feature/modular-plans-entitlements`. Base esperada: `cb1884e413203baa123ca94dfb0a4c4635b6502a`; head funcional revisado: `3f4ef1bfeb60a104e4e17e116462d24f301a3050`. O commit posterior contém apenas preparação de CI/revisão e evidências. Nenhum histórico foi reescrito.

## Título proposto

Bloco 02: reconciliação durável do Widget, persistência Instagram e correções de segurança — revisão independente

## Corpo proposto

Quando o Chatwoot criava a inbox e outro escritor removia a reserva dos settings, uma nova tentativa podia emitir outro POST. A operação agora fica persistida separadamente, e a retomada por ID reconcilia a inbox existente com GET/PATCH. Timeout sem ID comprovado permanece bloqueado para reconciliação operacional, inclusive após perda do JSON. O teste funcional que reproduzia duplicação passou sem retirar a asserção original.

O incremento também implementa consumo único de state OAuth e recibos duráveis de webhook Instagram no PostgreSQL; revalida associação ativa nas rotas pessoais e papel atual do banco; exige segredo no webhook Asaas; atualiza pontualmente Next/NextAuth para eliminar ranges críticos. ESLint compatível com Next16 mantém as regras. Sem mudança em enforcement comercial: observe_only e APPROVED_ENFORCEMENTS vazio.

Validação local do candidato funcional: 101 testes Node/PostgreSQL, 171 TypeScript, 22 checks HTTP, typecheck, Prisma validate/schema diff e build passaram. Providers/auth transport nos testes de handlers são simulados; o smoke usa login HTTP real. Lint global falha com182 erros/77 avisos anteriores; lint focado passa. Auditoria atual:46 pacotes (0 críticos/40 altos/3 moderados/3 baixos), contra49/2 críticos na base auditada no mesmo momento; o snapshot anterior de17 está preservado e classificado, sem tratá-lo como resultado atual. Nenhum pacote/advisory direto novo nessa comparação; isso não certifica ausência de exploração alcançável.

Esta PR deve permanecer Draft. Nenhum gate aprovado, sem merge/deploy/publicação/migrations em produção ou enforcement. Pendências: saneamento/rotação do histórico, lint global, dependências, providers reais, reconciliação operacional, CI do novo SHA e revisão independente. Relatório: docs/BLOCK2_CLOSURE_LOCAL_REPORT_2026-10-20.md; riscos por diagnóstico/pacote: docs/BLOCK2_INDEPENDENT_RISK_REGISTER_2026-10-20.md e docs/evidence/BLOCK2_INDEPENDENT_RISKS_2026-10-20.json. Evidências de execução nesta instância: /workspace/mds-crm-onboarding-evidence/independent.

Rollback para avaliação: suspender fluxos afetados antes de reverter; preservar tabelas, IDs e recibos (pending/remote_unknown incluídos). Reverter dependências reabre avisos corrigidos, e reverter guards reabre acesso de identidade removida: exige restrição das superfícies e decisão de segurança. Não há execução autorizada de rollback ou migration em produção.

## Solicitação de revisão a enviar depois do desbloqueio

Responsável distinto do implementador: revisar G1–G6 e registrar parecer por gate, reproduzindo casos críticos no PostgreSQL descartável. Priorizar perda de reserva após POST, timeout sem ID, vínculo tenant/conta/URL e referências legadas do Widget; consumo único/replay Instagram; validade de associação/papel em cada método; exceções públicas; alcance dos avisos npm e classificação do lint. Confirmar política observe_only e plano de rollback. Não inferir aprovação a partir de CI verde.

Não foi enviado pedido de review no GitHub. A consulta de colaboradores retornou apenas mundodigitalsolucoes, a própria conta autenticada; não há CODEOWNERS rastreado nem revisor independente identificado. É necessário indicar uma pessoa/time distinto com acesso, sem solicitar autoaprovação. Não se criou issue ou mensagem externa para contornar ausência de PR.

## Procedimento após decisão explícita sobre o histórico

1. Responsável confirma validade/revogação/rotação dos quatro candidatos sensíveis do env backup, sem valores em chat, logs ou Git. Não testar credenciais contra serviços reais.
2. Decidir o tratamento do histórico: uma exclusão em novo commit não elimina blobs antigos. Reescrever ancestrais mudaria base e SHAs dos nove commits e exige plano separado, coordenação com terceiros e autorização específica. Nada disso foi executado. Aceitar risco histórico exige exceção explícita; não equivale a certificar ausência de credenciais.
3. Revalidar por ls-remote as duas refs imediatamente antes de eventual push. Se base diferir do SHA esperado ou audit existir com SHA inesperado, interromper para decisão. Não fazer force push, merge, rebase ou reset automático. Uma leitura anterior não certifica que não haverá corrida entre duas refs; conferir novamente após o push e antes da PR.
4. Somente depois das condições satisfeitas, enviar a ref explícita audit/block2-closure (sem tags/outras branches), criar PR --draft contra feature/modular-plans-entitlements e solicitar o reviewer indicado. Não executar esses passos apenas por este documento.
5. Acompanhar os quatro workflows preparados para pull_request: Authorization Regression, PostgreSQL Handler and Concurrency, C03-C04 Security Regression e C03-C04 Build Validation. Registrar URL, SHA executado, status, logs e limitações. Não atribuir o sucesso da base ao candidato; não executar jobs de deploy. CI remota deve certificar o SHA efetivamente enviado, inclusive eventual merge ref de PR.

A verificação de refs foi satisfatória nesta execução; o bloqueio é histórico sensível e não um conflito remoto detectado. Não há PR URL porque a publicação condicionada não ocorreu.
