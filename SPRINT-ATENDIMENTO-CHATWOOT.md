# SPRINT ATENDIMENTO | MDS CRM SaaS

**Projeto:** `mundodigitalsolucoes/mds-crm-saas`  
**Data de início:** 28/03/2026  
**Responsável:** Mundo Digital Soluções  
**Status atual:** EM ANDAMENTO  
**Última atualização:** 28/03/2026

---

## 1. Objetivo do sprint

Organizar e estabilizar o módulo de **Atendimento** do CRM, usando o **Chatwoot como backend operacional**, com foco em segurança, previsibilidade e evolução comercial do SaaS.

Este sprint existe para parar o looping de alterações, evitar bugs em cascata e criar uma trilha clara de execução.

---

## 2. Norte do produto

- O CRM é um **SaaS para venda de assinaturas**
- Cada conta deve ser **100% independente por organização**
- O Chatwoot deve funcionar como **backend do atendimento**
- O foco atual é **Atendimento + Chatwoot + WhatsApp**
- Respostas, tarefas e alterações devem ser **curtas, isoladas e rastreáveis**

---

## 3. Regras oficiais do sprint

1. Trabalhar **uma tarefa por vez**
2. Mexer no **menor número possível de arquivos**
3. Nenhuma alteração sem definir antes:
   - objetivo
   - arquivos afetados
   - risco
   - teste esperado
   - critério de pronto
4. Nenhuma correção deve puxar refatoração paralela
5. Toda tarefa concluída precisa gerar:
   - evidência
   - status atualizado neste arquivo
   - commit isolado
6. Toda organização deve continuar **isolada das demais**
7. Nada que comprometa contas reais em produção

---

## 4. Escopo congelado deste sprint

### Dentro do escopo
- Atendimento via Chatwoot
- Revogação de acesso ao deletar usuário ou organização
- Cleanup de contas e sessões no Chatwoot
- Cleanup de WhatsApp / Evolution
- Estratégia de auto-login / SSO
- Estabilização do fluxo CRM → Chatwoot → Atendimento

### Fora do escopo agora
- Relatórios
- Branding
- Refatoração ampla
- Marketing
- GMN dentro do atendimento
- Qualquer módulo fora do core de atendimento

---

## 5. Ordem oficial dos canais

1. WhatsApp
2. Widget do site
3. Instagram
4. E-mail
5. GMN (avaliações e métricas, em trilha separada)

---

## 6. Arquivos centrais do sprint

- `src/app/(app)/atendimento/page.tsx`
- `src/app/api/integrations/chatwoot/credentials/route.ts`
- `src/lib/integrations/chatwoot-provision.ts`
- `src/lib/auth.ts`
- `middleware.ts`
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/lib/integrations/chatwoot-cleanup.ts`
- `prisma/schema.prisma`

---

## 7. Estrutura dos sprints

### SPRINT A | Organização e contenção
**Status:** PARCIALMENTE VALIDADA  
**Objetivo:** parar o looping e criar governança de execução.

**Ações:**
- [x] Criar documento oficial do sprint
- [x] Definir este arquivo como fonte única de verdade
- [x] Congelar escopo em Atendimento + Chatwoot + WhatsApp
- [x] Trabalhar 1 frente por vez
- [x] Respostas curtas e rastreáveis
- [ ] Garantir teste + evidência + commit por tarefa em todas as frentes futuras

**Critério de pronto:**
- documento versionado na raiz
- escopo congelado
- ordem de execução definida
- nenhuma alteração fora do fluxo oficial

---

### SPRINT B | Revogação de acesso e segurança
**Status:** VALIDADA  
**Objetivo:** garantir que usuário e organização deletados percam acesso de verdade.

**Ações:**
- [x] Revisar exclusão de usuário
- [x] Revisar exclusão de organização
- [x] Garantir soft delete dos usuários da org
- [x] Garantir bloqueio imediato no CRM
- [x] Garantir revogação de sessões críticas
- [x] Validar com contas fake
- [x] Corrigir isolamento entre organizações no Atendimento/Chatwoot

**Resultado validado:**
- Usuário deletado não acessa mais o CRM
- Organização deletada não mantém acesso residual
- Novo login após delete falha corretamente
- Sessão residual deixou de ser problema operacional
- Nova organização não herda mais conta anterior no iframe
- Refresh e relogin mantêm a org correta no Atendimento

**Arquivos envolvidos nesta validação:**
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/lib/checkPermission.ts`
- `src/lib/auth.ts`
- `middleware.ts`
- `src/app/api/integrations/chatwoot/credentials/route.ts`
- `src/app/(app)/atendimento/page.tsx`
- `src/lib/integrations/chatwoot-provision.ts`

---

### SPRINT C | Auto-login / SSO do Atendimento
**Status:** NÃO INICIADA  
**Objetivo:** remover a dependência do login manual no iframe.

**Ações:**
- [ ] Definir arquitetura do SSO curto
- [ ] Criar emissão no CRM
- [ ] Criar autenticação no lado Chatwoot
- [ ] Redirecionar iframe para sessão autenticada
- [ ] Manter fallback manual apenas como contingência
- [ ] Testar signup, refresh e relogin

**Observação atual:**
- O Atendimento está isolado corretamente por organização
- O login manual no Chatwoot ainda continua como contingência operacional
- O banner com credenciais ainda não foi removido do fluxo principal

---

### SPRINT D | Cleanup de contas fantasmas
**Status:** PRÓXIMA FRENTE OFICIAL  
**Objetivo:** impedir resíduos operacionais após delete.

**Ações:**
- [ ] Validar invalidação de sessões no Chatwoot
- [ ] Validar remoção de vínculos
- [ ] Validar delete via API
- [ ] Validar purge via SQL quando necessário
- [ ] Confirmar limpeza de org e membros
- [ ] Garantir que conta/user não fiquem poluindo o Chatwoot Admin

**Problema atual confirmado:**
- No CRM, delete e revogação estão corretos
- No Chatwoot, conta e usuário podem permanecer visíveis mesmo sem acesso operacional
- O problema agora é de cleanup/containment, não mais de segurança do CRM

**Arquivos alvo prováveis:**
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/lib/integrations/chatwoot-cleanup.ts`
- `src/lib/integrations/chatwoot-provision.ts`

---

### SPRINT E | WhatsApp estável no Atendimento
**Status:** NÃO INICIADA  
**Objetivo:** fazer o WhatsApp funcionar como primeiro canal oficial.

**Ações:**
- [ ] Validar conexão
- [ ] Criar inbox automática
- [ ] Registrar webhook automático
- [ ] Validar recebimento e resposta
- [ ] Validar desconexão com limpeza

---

### SPRINT F | Homologação final
**Status:** NÃO INICIADA  
**Objetivo:** validar o fluxo completo antes de comercializar em escala.

**Ações:**
- [ ] Testar signup → atendimento
- [ ] Testar WhatsApp → Chatwoot → CRM
- [ ] Testar delete de usuário
- [ ] Testar delete de organização
- [ ] Repetir com 3 contas fake diferentes

---

## 8. Próxima tarefa oficial

### Tarefa 06
**Nome:** Conter contas fantasmas no Chatwoot

**Motivo:**  
A segurança do CRM foi validada, mas o Chatwoot ainda pode manter resíduos visuais e operacionais após exclusão.

**Resultado esperado:**  
- conta e usuário deletados no CRM tentam ser removidos no Chatwoot
- se o delete real falhar, o sistema aplica contenção forte
- o Chatwoot deixa de acumular lixo operacional

---

## 9. Modelo de acompanhamento por tarefa

## Nome da tarefa
[preencher]

## Objetivo
[preencher]

## Arquivos afetados
- [preencher]
- [preencher]

## Risco
Baixo / Médio / Alto

## Teste esperado
[preencher]

## Resultado real
[preencher]

## Status
Não iniciado / Em andamento / Validado / Bloqueado

## Evidência
[print, log, commit, observação]

---

## 10. Registro rápido de tarefas

- [x] Tarefa 01 — Organizar sprint oficial do atendimento
- [x] Tarefa 02 — Corrigir revogação de acesso ao deletar usuário
- [x] Tarefa 03 — Corrigir revogação de acesso ao deletar organização
- [ ] Tarefa 04 — Implementar auto-login / SSO do Chatwoot
- [ ] Tarefa 05 — Remover dependência do banner com senha
- [ ] Tarefa 06 — Conter contas fantasmas no Chatwoot
- [ ] Tarefa 07 — Automatizar inbox do WhatsApp
- [ ] Tarefa 08 — Automatizar webhook Evolution → Chatwoot
- [ ] Tarefa 09 — Homologar com 3 contas fake

---

## 11. Atualização de validação executada

### Evidências validadas até agora
- Membro fake deletado sem acesso a novo login
- Organização fake deletada sem acesso a novo login
- Soft delete funcionando com mascaramento de e-mail
- Build local passou limpo
- Atendimento não herda mais conta de organização anterior
- Refresh e logout/login preservam a org correta no iframe

### Conclusão operacional
- **Sprint B validada**
- **Próxima prioridade: Sprint D**
- **Sprint C continua dependente de implementação própria de SSO**
- **WhatsApp continua fora da frente atual até cleanup e contenção ficarem estáveis**

---

## 12. Detalhamento consolidado da Tarefa 02 e 03

## Tarefa 02 | Corrigir revogação de acesso ao deletar usuário
**Status:** VALIDADA  
**Prioridade:** CRÍTICA  
**Sprint:** B | Revogação de acesso e segurança

### Objetivo
Garantir que usuários deletados percam acesso ao CRM de forma previsível e sem vazamento de sessão.

### Resultado validado
- Usuário deletado não consegue novo login
- Sessão inválida deixa de navegar no CRM
- Soft delete substitui hard delete com segurança

---

## Tarefa 03 | Corrigir revogação de acesso ao deletar organização
**Status:** VALIDADA  
**Prioridade:** CRÍTICA  
**Sprint:** B | Revogação de acesso e segurança

### Objetivo
Garantir que organizações deletadas não mantenham usuários ativos nem contexto residual no Atendimento.

### Resultado validado
- Organização deletada perde acesso ao CRM
- Usuários da org deletada ficam bloqueados
- Atendimento deixou de herdar account incorreta no Chatwoot
- Isolamento entre organizações ficou validado

---

## 13. Detalhamento da próxima frente

## Tarefa 06 | Conter contas fantasmas no Chatwoot
**Status:** NÃO INICIADA  
**Prioridade:** ALTA  
**Sprint:** D | Cleanup de contas fantasmas

### Objetivo
Garantir que deletar usuário ou organização no CRM não deixe conta, vínculo ou usuário residual no Chatwoot.

### Problema atual
- No CRM a exclusão está segura
- No Chatwoot ainda pode sobrar conta ou usuário listado no Admin
- Isso gera poluição operacional e risco de inconsistência futura

### Escopo desta tarefa
- Revisar cleanup no delete da organização
- Revisar cleanup no delete de membro
- Validar rota/API real de remoção
- Aplicar contenção forte quando o delete total falhar
- Confirmar comportamento no Admin do Chatwoot

### Arquivos alvo iniciais
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/lib/integrations/chatwoot-cleanup.ts`
- `src/lib/integrations/chatwoot-provision.ts`

### Risco
Médio

### Teste esperado
1. Criar org fake
2. Criar membro fake
3. Deletar membro
4. Deletar org
5. Validar se user/account somem do Chatwoot Admin
6. Se não sumirem, validar contenção operacional

### Critério de pronto
- Sem conta fantasma relevante
- Sem user fantasma operacional
- Sem vínculo residual útil no Chatwoot após delete
- CRM e Chatwoot coerentes o suficiente para seguir para Sprint C ou E

---

## 14. Observação final

Este sprint não é para mexer em tudo.  
É para estabilizar o core do atendimento com rastreabilidade.

**Regra de ouro:**  
menos alterações paralelas, mais validação real.