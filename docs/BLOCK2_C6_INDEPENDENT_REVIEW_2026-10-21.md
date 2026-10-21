# Formulário de revisão independente — Bloco 02 / C6

**Estado: PENDENTE.** Este arquivo prepara a revisão; não contém parecer independente nem aprovação de gates. Referência e resultados: [pacote C6](BLOCK2_C6_REVIEW_PACKAGE_2026-10-21.md), [evidências C6](evidence/BLOCK2_C6_RESULTS_2026-10-21.json), [antes/depois C5](evidence/BLOCK2_C5_SECURITY_RESULTS_2026-10-21.json).

- Revisor/papel e independência em relação aos autores: **a preencher**.
- SHA final revisado e SHA da base saneada: **a preencher pelo revisor**.
- Integridade do bundle/manifesto/patch e ausência de refs/objetos antigos: **a verificar**.
- Data, ambiente e versões efetivamente usados na reprodução: **a preencher**.
- URLs de CI remota e SHA real do checkout: **não existem nesta rodada; preencher após envio autorizado**.

| Gate | Questões obrigatórias | Parecer independente |
|---|---|---|
| G1 | Identidade ativa antes da consulta; sessões/reset/admin/concorrência e C0 HTTP | PENDENTE |
| G2 | Método a método: permissão, relações, efeitos colaterais, rotas indiretas; nenhuma permissão artificial | PENDENTE |
| G3 | Tenant/IDs/notificações; Widget CAS/timeout/reserva/reconciliação; providers e isolamento de credenciais | PENDENTE |
| G4 | State atômico single-use; assinatura/replay; recibos duráveis e recuperação; migrations/retention | PENDENTE |
| G5 | Sete contratos; Owner não ultrapassa assinatura na apresentação; recursos compartilhados/legados; lacunas de bloqueio observacional | PENDENTE |
| G6 | Histórico saneado, CI do SHA certo, 18 pacotes sinalizados/avisos de lint, rollback e compatibilidade de produção | PENDENTE |

Conferir explicitamente os dois probes C5 intactos: falhas originais **42 + nove notificações** e **28 exposições de Lead**; depois **42 PASS, zero notificações e zero exposições**. Reproduzir também os positivos, não apenas fontes/negações. Testes novos de PostgreSQL devem continuar comprovando nenhuma alteração parcial.

Registrar por achado: severidade, arquivo/operação, evidência reproduzível sem dados reais, tenant/papel, risco, correção ou exceção fundamentada, responsável e prazo. Tratar diagnósticos legados como riscos, sem converter comportamentos observados em política aprovada. Distinguir revisão por pessoa de testes automatizados/mocks.

**Decisão global:** PENDENTE. Aprovado/reprovado/condicionado deve identificar SHA, critérios de cada gate, exceções explícitas e responsável. Nenhuma assinatura deste formulário, isoladamente, autoriza merge, deploy, migration, Coolify ou enforcement. Piloto Ótica exige decisão separada e Marketing efetivamente indisponível por URLs/APIs, além de navegação.
