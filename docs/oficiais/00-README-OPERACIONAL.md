# README OPERACIONAL — MDS CRM SaaS

**Projeto:** MDS CRM SaaS  
**Status geral:** MVP em fase final de organização e estabilização  
**Branch oficial:** `main`  
**Deploy:** manual no Coolify, feito pelo usuário  
**Ambiente local:** VS Code + Git Bash no Windows

---

## 1. O QUE É O PROJETO

O MDS CRM SaaS é um CRM de marketing e vendas com foco comercial forte em:

- Atendimento
- Leads
- pipeline de vendas
- agenda
- metas
- projetos / OS
- relatórios
- integrações

O sistema é pensado para operação multiatendimento e multicanal, com integração entre operação comercial, canais de contato e gestão. :contentReference[oaicite:3]{index=3}

---

## 2. ARQUITETURA OFICIAL

A arquitetura oficial do projeto é:

- Atendimento como backend operacional oficial
- CRM como camada de orquestração, UX, permissões e contexto
- providers de canal como transportes especializados
- Hub de Integrações como camada única de configuração do ecossistema :contentReference[oaicite:4]{index=4}

### Regra-mãe
- o CRM não recria a lógica operacional nativa do Atendimento
- o CRM organiza setup, permissões, status resumido, nomes amigáveis e contexto comercial
- o transporte técnico do canal depende do provider configurado :contentReference[oaicite:5]{index=5}
- É proibido alterar código sem evidência clara, risco mapeado e rollback.
Não fazer hotfix isolado.
Não refatorar sem necessidade.
Não mexer em Atendimento/core protegido.
Trabalhar 1 passo por vez.
Separar fato de hipótese.

---

## 3. O QUE O CRM DEVE FAZER

O CRM deve:

- facilitar configuração
- resumir status
- proteger a operação
- conectar Atendimento com Leads e Vendas
- organizar o ecossistema de integrações :contentReference[oaicite:6]{index=6}

Além disso, o CRM deve integrar os módulos centrais do MVP comercial:

- Atendimento
- Leads
- pipeline / Kanban comercial
- agenda e follow-up
- metas
- projetos / OS
- integrações centrais
- billing / planos
- autenticação e permissões 

---

## 4. O QUE O CRM NÃO DEVE FAZER

O CRM não deve:

- recriar engine de conversa
- recriar engine de inbox
- recriar relatórios operacionais brutos
- inventar fluxo paralelo ao Atendimento :contentReference[oaicite:8]{index=8}

Também não deve confundir:

- Atendimento com marketing em massa
- número operacional de atendimento com ativo padrão de disparo
- provider técnico com fluxo operacional do atendente 

---

## 5. REGRA OFICIAL DO WHATSAPP

O WhatsApp no projeto opera por providers separados:

- **WhatsApp Business**
- **WhatsApp API Oficial** :contentReference[oaicite:10]{index=10}

### Regras obrigatórias
- 1 número = 1 inbox = 1 canal operacional
- 1 canal WhatsApp = 1 provider
- nunca misturar providers no mesmo canal
- sem provider definido, o canal não é canônico 


---

## 6. CORE PROTEGIDO

O core protegido do projeto inclui:

- todos os arquivos ligados ao Atendimento via iframe
- `src/app/(app)/atendimento/page.tsx`
- `src/app/api/integrations/chatwoot/credentials/route.ts` :contentReference[oaicite:13]{index=13}

### Regra
Essas áreas não podem ser alteradas sem:

- evidência real do problema
- risco mapeado
- rollback claro :contentReference[oaicite:14]{index=14}

---

## 7. FOCO ATUAL DO MVP

A prioridade atual do projeto é:

1. estabilizar Atendimento
2. estabilizar Vendas
3. fechar a integração comercial entre Atendimento e Vendas
4. reduzir bugs ligados ao backend operacional do Atendimento
5. concluir o MVP com segurança para lançamento comercial 

### Pendências críticas conhecidas
- webhook Asaas com pagamento real
- contenção de contas fantasma após exclusão de organização
- testes end-to-end completos
- validação final de Relatórios e Membros / Permissões :contentReference[oaicite:16]{index=16}
- Testar todas as funções, pois estamos em teste real para lançamento e existe vários bugs entre integrações
- Bug para teste em desevolvimento localhost

---

## 8. MÓDULOS DO PROJETO

### Já maduros / funcionais
- Dashboard
- Leads
- Kanban
- Projetos / OS
- Tarefas / Agenda
- Metas
- Atendimento
- Super Admin
- Auth
- Planos / Cupons :contentReference[oaicite:17]{index=17}

### Ainda exigem fechamento ou validação
- Relatórios
- Membros / Permissões
- automações centrais de WhatsApp
- fluxo comercial completo do MVP 

### Pós-MVP
- Marketing avançado
- métricas expandidas
- SaaS escalável
- chatbot builder :contentReference[oaicite:19]{index=19}

---

## 9. PROCESSO DE TRABALHO

### Git
Fluxo local:
- `git add`
- `git commit`
- `git push`

### Deploy
- o deploy nunca é automático
- após o push, a publicação é manual no Coolify e feita pelo usuário

### Regra de execução com o agente
- 1 passo por vez
- resposta curta
- separar fatos de hipóteses
- confirmar acesso ao repositório antes de orientar mudança sensível
- não mexer em core protegido sem risco e rollback

### STATUS-ATUAL
- Sempre atualizar o Status-Atual do projeto ao concluir nova etapa

---

## 10. FONTES OFICIAIS DE VERDADE

Seguir nesta ordem:

1. Instruções do Project
2. Documento Mestre Oficial
3. STATUS-ATUAL
4. LOG-DE-DECISOES
5. BACKLOG-PRIORIZADO
6. GitHub do repositório
7. Arquivos do Project

Material legado vale apenas como apoio histórico.

---

## 11. FRASE OFICIAL DO PROJETO

No Atendimento do MDS CRM, o backend operacional é o motor, o CRM é a cabine, e o transporte do canal depende do provider certo.

O projeto não deve construir outro motor.  
Deve organizar a operação para cada canal rodar no trilho certo. :contentReference[oaicite:20]{index=20}