# Bloco 02 — Gate de encerramento técnico (19/10/2026)

**Branch:** `feature/modular-plans-entitlements`  
**Commit avaliado:** `4220877fd28104391c60c5cd96f53668766f4499`  
**Decisão:** **NÃO ENCERRADO / NÃO HOMOLOGADO**. Correções candidatas e testes automatizados aprovados não equivalem à aprovação funcional ou ao enforcement comercial.

## Evidência positiva

- GitHub Actions **Block 2 Authorization Regression #114**, commit `4220877`: **success** — https://github.com/mundodigitalsolucoes/mds-crm-saas/actions/runs/39292164916.
- Correções de assinatura dos webhooks WhatsApp Cloud e Instagram; Chatwoot com segredo obrigatório.
- OAuth Instagram com state assinado, validade, vínculo de sessão/tenant e nonce de cookie; validação de origem e segregação de dados de Meta.
- Proteções de isolamento de rotas de integrações, incluindo QR/lifecycle Evolution, troca de token, mapeamento fail-closed de Instagram Business ID ambíguo e seleção/sincronização da Página Facebook por organização.
- Criação de inbox Instagram exige estado conectado e credenciais Meta presentes; respostas de erro de provider foram saneadas.
- Motor comercial em `observe_only`; `APPROVED_ENFORCEMENTS` vazio. Não há autorização para ativar bloqueios comerciais.

## Bloqueios de aceite (não confundir com melhorias futuras)

| Gate | Evidência exigida | Situação |
| --- | --- | --- |
| G1 — C03/C04 | Homologação autenticada com usuários fictícios, banco descartável, casos de login admin, signup concorrente, deleted users e recuperação | **PENDENTE**; plano em `docs/BLOCK2_C03_C04_FUNCTIONAL_HOMOLOGATION.md` |
| G2 — Cobertura completa | Inventário verificável de páginas, handlers por método, server actions e rotas indiretas; política ou exceção fundamentada para cada superfície | **PENDENTE**; `docs/BLOCK2_TECHNICAL_COVERAGE_REMAINING.md` reconhece cobertura parcial |
| G3 — Isolamento e providers | Testes de integração multi-tenant com banco descartável e mocks Chatwoot/Evolution/Meta/Google; casos de IDOR, falha, callbacks e replay | **PENDENTE**; testes estáticos não bastam |
| G4 — Segurança OAuth/replay | Evidência de consumo único atômico do state Instagram, ou aceitação formal do risco residual; idempotência do webhook Instagram | **PENDENTE**; desenho de single-use exige decisão de armazenamento/migração |
| G5 — Política comercial | Contratos de entitlement/capacidade, recursos compartilhados, compatibilidade legada e plano de rollout por tenant | **PENDENTE**; manter `observe_only` |
| G6 — Revisão independente | Revisão de segurança, plano de rollback, aceite explícito para promoção | **PENDENTE** |

## Itens separáveis do Bloco 02 (backlog, não autorizar automaticamente)

- Cobrança em atraso com tolerância de 10 dias e classificação de conta interna: política futura, sem cobrança ativa.
- Otimização do lookup de Instagram Business ID (hoje consulta configurações das organizações); índice/constraint requer modelagem e migração aprovadas.
- Melhorias de diagnóstico/UX das integrações que não alterem controles de acesso.

## Procedimento mínimo para fechar

1. Congelar escopo e SHA candidato; nenhuma alteração adicional de feature durante o gate.
2. Concluir matriz de cobertura por endpoint/ação e classificar lacunas de segurança como bloqueantes ou exceções documentadas.
3. Executar homologação funcional em ambiente isolado com banco descartável, usuários e credenciais fictícios, mocks de providers e evidências PASS/FAIL/SKIP.
4. Submeter riscos residuais, decisões de replay e políticas comerciais à revisão independente.
5. Somente com todos os gates satisfeitos e aceite explícito marcar **Bloco 02 encerrado**. A aprovação do bloco não autoriza por si só merge, deploy, migração nem enforcement.

## Restrições preservadas

Sem merge, deploy, migrations, alterações no Coolify/produção ou `APPROVED_ENFORCEMENTS`. Conta da Ótica São Paulo **não é necessária** para testes isolados; solicitar somente quando houver homologação piloto autorizada.
