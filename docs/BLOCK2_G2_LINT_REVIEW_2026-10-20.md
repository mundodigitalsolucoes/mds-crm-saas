# Bloco 02 — revisão G2 e classificação do lint

Baseline: d541622, mantendo os cinco commits anteriores. Evidências completas em `/workspace/mds-crm-onboarding-evidence/blockers/`.

## G2

A revisão por método classifica **116 arquivos, 177 métodos e 50 páginas/layouts**, sem método não classificado. `g2-review.json` e `g2-review.md` registram fonte/linha, guards e base de autorização ou exceção: SuperAdmin dedicado, permissão operacional, associação ativa de recurso pessoal, NextAuth delegado, OAuth customizado, webhooks autenticados, CORS e contratos públicos. O contrato legado de cupom público e a política comercial continuam explícitos; classificação não é aceite de produto nem autorização para enforcement. Nenhuma diretiva `use server` foi encontrada no inventário anterior; código dinâmico/indireto não é automaticamente certificado por essa busca.

Achado funcional corrigido: seis rotas pessoais conferiam apenas claims de sessão, permitindo GET de auth/me de usuário removido (HTTP 200 reproduzido). auth/me, auth/export-data, auth/delete-account, notifications, notifications/read e usage agora reutilizam checkAuth, que valida associação e status ativos no banco. Não se alterou a regra de papel do core nem a semântica de negócio das operações legítimas. A matriz real de PostgreSQL testa três papéis e 54 combinações negativas (usuário removido, tenant removido, organização da sessão divergente) nas seis rotas, além de 18 combinações legítimas, incluindo owner impedido de excluir sua própria conta. Duas funções de teste agrupam essas 72 combinações; não se inflou a contagem de testes. Asserções antes/depois e ausência de mutação indevida estão registradas.

O inventário é revisão estática, não comprovação de todos os ramos ou uma auditoria independente. As matrizes funcionais existentes de Vendas/Atendimento e os testes de providers foram repetidos; contrato de recurso pessoal, exceções públicas/abuso de endpoints, dados legados inconsistentes e caminhos administrativos continuam pontos para revisão independente antes do aceite formal. Os guards comerciais e APPROVED_ENFORCEMENTS não foram alterados.

## Lint: origem e relevância são eixos diferentes

O baseline tinha **218 erros e 77 avisos**. O resultado parcial desta rodada é **184 erros e 77 avisos**: 34 erros corrigidos, **zero diagnósticos introduzidos**. `lint-classification.json` registra cada diagnóstico restante, fonte/linha/regra, comparação ao código em d541622 e presença no candidato original cb1884e. Não se classificou uma regra de estilo como vulnerabilidade explorável por suposição.

Correções do escopo: tipos do handler NextAuth sem any/casts, const no signup, tipos explícitos no diagnóstico Instagram, remoção de atualização síncrona redundante de loading no Widget (já inicializado true; ações têm seus próprios estados), nomes locais que colidiam com module e migração dos testes Node CommonJS para ESM preservando as asserções. Workflows e script test:security usam os novos nomes. Nenhuma regra ESLint foi desativada e nenhum arquivo foi escondido dos checks.

Os 45 diagnósticos restantes classificados como relevantes para revisão de fronteira estão em APIs/helpers sensíveis (tipagem ampla e/ou avisos), mas não constituem por si só 45 falhas de autorização. O restante é dívida anterior de UI, React hooks, tipagem e estilo. Não houve refatoração global de telas, fixtures genéricas ou outros módulos. Fixtures e telas anteriores do Bloco 02 ainda possuem dívidas de estilo; isso é explicitamente restante, não aprovado nem convertido em exceção silenciosa. O lint global continua retornando 1 e G6 não pode ser declarado verde com esse resultado.

Arquivos novos/alterados de produção e testes específicos receberam lint focado, typecheck, build e regressão. Os resultados finais do check focado e das suites constam do adendo consolidado. Uma eventual divergência de contagem deve ser lida pelo artefato final, sem misturar o escopo de main com o da candidata.

Rollback: reverter este incremento restaura as rotas pessoais que aceitavam identidade removida; bloquear essas operações durante eventual recuo e submeter a revisão. Nenhum rollback em produção foi autorizado ou executado.
