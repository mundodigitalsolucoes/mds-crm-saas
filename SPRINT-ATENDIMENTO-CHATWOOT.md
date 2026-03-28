# SPRINT ATENDIMENTO | MDS CRM SaaS

**Projeto:** `mundodigitalsolucoes/mds-crm-saas`  
**Data de início:** 28/03/2026  
**Responsável:** Mundo Digital Soluções  
**Status atual:** EM ANDAMENTO

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
**Objetivo:** parar o looping e criar governança de execução.

**Ações:**
- [x] Criar documento oficial do sprint
- [x] Definir este arquivo como fonte única de verdade
- [x] Congelar escopo em Atendimento + Chatwoot + WhatsApp
- [ ] Mapear fluxo real ponta a ponta
- [ ] Criar regra prática de execução: 1 tarefa por vez
- [ ] Garantir teste + evidência + commit por tarefa

**Critério de pronto:**
- documento versionado na raiz
- escopo congelado
- ordem de execução definida
- nenhuma alteração fora do fluxo oficial

---

### SPRINT B | Revogação de acesso e segurança
**Objetivo:** garantir que usuário e organização deletados percam acesso de verdade.

**Ações:**
- [ ] Revisar exclusão de usuário
- [ ] Revisar exclusão de organização
- [ ] Garantir soft delete dos usuários da org
- [ ] Garantir bloqueio imediato no CRM
- [ ] Garantir revogação de sessões críticas
- [ ] Testar com contas fake

---

### SPRINT C | Auto-login / SSO do Atendimento
**Objetivo:** remover a dependência do login manual no iframe.

**Ações:**
- [ ] Definir arquitetura do SSO curto
- [ ] Criar emissão no CRM
- [ ] Criar autenticação no lado Chatwoot
- [ ] Redirecionar iframe para sessão autenticada
- [ ] Manter fallback manual apenas como contingência
- [ ] Testar signup, refresh e relogin

---

### SPRINT D | Cleanup de contas fantasmas
**Objetivo:** impedir resíduos operacionais após delete.

**Ações:**
- [ ] Validar invalidação de sessões no Chatwoot
- [ ] Validar remoção de vínculos
- [ ] Validar delete via API
- [ ] Validar purge via SQL quando necessário
- [ ] Confirmar limpeza de org e membros

---

### SPRINT E | WhatsApp estável no Atendimento
**Objetivo:** fazer o WhatsApp funcionar como primeiro canal oficial.

**Ações:**
- [ ] Validar conexão
- [ ] Criar inbox automática
- [ ] Registrar webhook automático
- [ ] Validar recebimento e resposta
- [ ] Validar desconexão com limpeza

---

### SPRINT F | Homologação final
**Objetivo:** validar o fluxo completo antes de comercializar em escala.

**Ações:**
- [ ] Testar signup → atendimento
- [ ] Testar WhatsApp → Chatwoot → CRM
- [ ] Testar delete de usuário
- [ ] Testar delete de organização
- [ ] Repetir com 3 contas fake diferentes

---

## 8. Próxima tarefa oficial

### Tarefa 02
**Nome:** Corrigir revogação de acesso ao deletar usuário e organização

**Motivo:**  
Sem isso, qualquer avanço no atendimento continua em cima de uma base insegura.

**Resultado esperado:**  
- usuário deletado não acessa mais
- organização desativada não mantém usuário ativo
- sprint fica seguro para seguir para SSO

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
- [ ] Tarefa 02 — Corrigir revogação de acesso ao deletar usuário = em andamento
- [ ] Tarefa 03 — Corrigir revogação de acesso ao deletar organização
- [ ] Tarefa 04 — Implementar auto-login / SSO do Chatwoot
- [ ] Tarefa 05 — Remover dependência do banner com senha
- [ ] Tarefa 06 — Conter contas fantasmas no Chatwoot
- [ ] Tarefa 07 — Automatizar inbox do WhatsApp
- [ ] Tarefa 08 — Automatizar webhook Evolution → Chatwoot
- [ ] Tarefa 09 — Homologar com 3 contas fake

---

## 11. Observação final

Este sprint não é para mexer em tudo.  
É para estabilizar o core do atendimento com rastreabilidade.

**Regra de ouro:**  
menos alterações paralelas, mais validação real.

---

Detalhamento da Tarefa 02

## Tarefa 02 | Corrigir revogação de acesso ao deletar usuário e organização

**Status:** EM ANDAMENTO  
**Prioridade:** CRÍTICA  
**Sprint:** B | Revogação de acesso e segurança

### Objetivo
Garantir que usuários deletados e organizações desativadas percam acesso ao CRM de forma previsível e sem vazamento de sessão.

### Problema atual
- Sessão pode continuar ativa por janela de revalidação
- Organização desativada pode manter usuário com acesso residual
- Base do sprint ainda não está segura para avançar para SSO

### Escopo desta tarefa
- Revisar exclusão de usuário
- Revisar exclusão de organização
- Garantir soft delete dos usuários da org
- Garantir bloqueio confiável de navegação
- Validar comportamento com conta fake

### Arquivos alvo iniciais
- `src/app/api/admin/organizations/[id]/route.ts`
- `src/lib/auth.ts`
- `middleware.ts`

### Risco
Médio

### Teste esperado
1. Criar / usar conta fake ativa
2. Logar normalmente no CRM
3. Deletar usuário ou organização
4. Tentar continuar navegando
5. Tentar atualizar a página
6. Tentar novo login

### Resultado esperado
- Usuário deletado não acessa mais
- Organização desativada não mantém usuários ativos
- Sessão residual deixa de ser um problema operacional

### Critério de pronto
- Revogação funcionando com previsibilidade
- Sem acesso residual após delete
- Pronto para seguir para Sprint C (SSO)

### Observações
Nenhuma alteração paralela fora do escopo desta tarefa.