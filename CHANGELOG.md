# Changelog

## 2026-10-20 — candidato local Bloco 02

- Saneamento de erros do Widget Chatwoot, com testes de handlers e PostgreSQL e falha de reconciliação mantida como TODO explícito.
- Preparação autorizada de dois modelos e migration PostgreSQL para consumo único OAuth Instagram e recibos duráveis de webhook; aplicação somente no banco descartável local.
- Política comercial permanece observe_only, com APPROVED_ENFORCEMENTS vazio. Sem merge, deploy, publicação ou mudanças em produção.

## 2026-10-20 — correção dos bloqueadores locais do Bloco 02

- Widget: operação durável separada dos settings, retomada por ID e bloqueio de resultado remoto incerto; antigo TODO passou em 16 testes funcionais PostgreSQL.
- Atualização pontual Next 16.2.6 → 16.3.8 e NextAuth 4.24.14 → 4.24.15; auditoria de 2 para zero críticos, com 17 dependências ainda sinalizadas.
- Seis rotas pessoais revalidam associação ativa; 36 erros de lint do escopo corrigidos sem relaxar regras. Restam 182 erros e 77 avisos globais.
- Relatório oficial preservado e acrescido de comparação, evidências e bloqueios; gates continuam sem aprovação formal.
