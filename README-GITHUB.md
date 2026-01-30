# 🚀 MDS CRM - Mundo Digital Soluções

Sistema completo de CRM SaaS Multi-Tenant com integração nativa ao Chatwoot, IA para análise de leads e gestão visual de projetos de marketing.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Prisma](https://img.shields.io/badge/Prisma-5.0-2D3748)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-316192)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC)

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Stack Tecnológica](#️-stack-tecnológica)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação Local](#-instalação-local)
- [Deploy no Coolify](#-deploy-no-coolify)
- [Integração Chatwoot](#-integração-chatwoot)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Variáveis de Ambiente](#-variáveis-de-ambiente)
- [Licença](#-licença)

## ✨ Funcionalidades

### 🎯 Gestão de Leads
- Pipeline visual com Kanban drag-and-drop
- Scoring automático com IA (Google Gemini)
- Sincronização automática com Chatwoot
- Histórico completo de interações
- Filtros avançados e busca

### 📊 Dashboard & KPIs
- Métricas em tempo real
- Gráficos interativos (Recharts)
- Pipeline de vendas visual
- Análise de origem de leads
- ROI de campanhas

### 🎨 Projetos de Marketing
- Controle de campanhas
- Orçamento e ROI
- Timeline de projetos
- Kanban boards personalizáveis
- Relatórios detalhados

### ✅ Sistema de Tarefas
- Atribuição de responsáveis
- Prioridades e deadlines
- Integração com leads e projetos
- Notificações automáticas

### 💬 Integração Chatwoot
- Sincronização bidirecional
- Criação automática de leads
- Histórico de conversas
- Webhooks configuráveis

### 🤖 IA com Google Gemini
- Scoring de leads
- Análise preditiva
- Sugestões inteligentes
- Automações baseadas em IA

### 🏢 Multi-Tenant SaaS
- Isolamento completo de dados
- Sistema de convites para equipes
- Roles: Owner, Admin, Manager, User
- Planos: Starter, Professional, Enterprise

## 🛠️ Stack Tecnológica

### Frontend
- **Next.js 14** - App Router, Server Components
- **React 18** - Hooks, Suspense
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **shadcn/ui** - Component library
- **Recharts** - Gráficos e visualizações

### Backend
- **Next.js API Routes** - RESTful API
- **Prisma ORM** - Type-safe database client
- **PostgreSQL 15+** - Banco de dados principal
- **NextAuth.js** - Autenticação
- **Zod** - Validação de schemas

### Integrações
- **Chatwoot v4.10.1** - Chat e atendimento
- **Google Gemini API** - IA e análise
- **Stripe/Pagar.me** - Pagamentos e assinaturas

### DevOps
- **Docker** - Containerização
- **Coolify** - Deploy e hosting
- **GitHub Actions** - CI/CD (opcional)

## 📋 Pré-requisitos

- **Node.js** 18.0 ou superior
- **PostgreSQL** 15 ou superior
- **Git**
- **Conta no Coolify** (para deploy)
- **Chatwoot instalado** (para integração)

## 🏁 Instalação Local

### 1. Clone o repositório

\`\`\`bash
git clone https://github.com/seu-usuario/mds-crm-saas.git
cd mds-crm-saas
\`\`\`

### 2. Instale as dependências

\`\`\`bash
npm install
\`\`\`

### 3. Configure o banco de dados

Crie um banco PostgreSQL:

\`\`\`sql
CREATE DATABASE mds_crm;
\`\`\`

### 4. Configure as variáveis de ambiente

\`\`\`bash
cp .env.example .env
\`\`\`

Edite o arquivo \`.env\` com suas credenciais:

\`\`\`env
DATABASE_URL="postgresql://user:password@localhost:5432/mds_crm"
NEXTAUTH_SECRET="gere-com-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
CHATWOOT_API_URL="https://app.mundodigitalsolucoes.com.br/api/v1"
CHATWOOT_API_KEY="sua-api-key"
\`\`\`

### 5. Execute as migrations do Prisma

\`\`\`bash
npx prisma generate
npx prisma db push
\`\`\`

### 6. (Opcional) Popule com dados de exemplo

\`\`\`bash
npx prisma db seed
\`\`\`

### 7. Inicie o servidor

\`\`\`bash
npm run dev
\`\`\`

Acesse: **http://localhost:3000**

## 🐳 Deploy no Coolify

### 1. Prepare o repositório

\`\`\`bash
git add .
git commit -m "Initial commit"
git push origin main
\`\`\`

### 2. Configure no Coolify

1. Acesse seu painel do Coolify
2. Clique em **"New Resource"** → **"Public Repository"**
3. Cole a URL do repositório GitHub
4. Selecione **"Next.js"** como tipo de aplicação

### 3. Configure as variáveis de ambiente

No Coolify, adicione as seguintes variáveis:

\`\`\`env
DATABASE_URL=postgresql://user:pass@postgres:5432/mds_crm
NEXTAUTH_SECRET=[gerar novo com: openssl rand -base64 32]
NEXTAUTH_URL=https://crm.mundodigitalsolucoes.com.br
CHATWOOT_API_URL=https://app.mundodigitalsolucoes.com.br/api/v1
CHATWOOT_API_KEY=sua-chave-api
CHATWOOT_ACCOUNT_ID=1
GEMINI_API_KEY=sua-chave-gemini
\`\`\`

### 4. Adicione PostgreSQL

1. No Coolify, vá em **"Add a Database"**
2. Selecione **PostgreSQL 15**
3. Configure:
   - **Database Name:** mds_crm
   - **User:** mdscrm
   - **Password:** [gere uma senha forte]

### 5. Configure o domínio

1. No Coolify, vá em **"Domains"**
2. Adicione: **crm.mundodigitalsolucoes.com.br**
3. SSL será gerado automaticamente via Let's Encrypt

### 6. Deploy

1. Clique em **"Deploy"**
2. Aguarde o build e deploy
3. Acesse: **https://crm.mundodigitalsolucoes.com.br**

## 💬 Integração Chatwoot

### 1. Obter credenciais

1. Acesse: **https://app.mundodigitalsolucoes.com.br**
2. Vá em **Settings → Integrations → API**
3. Gere uma **Access Token**
4. Anote o **Account ID**

### 2. Configurar Webhook

No Chatwoot, vá em **Settings → Integrations → Webhooks**:

1. Clique em **"Add new webhook"**
2. Configure:
   - **URL:** \`https://crm.mundodigitalsolucoes.com.br/api/webhooks/chatwoot\`
   - **Events:**
     - ✅ conversation_created
     - ✅ conversation_status_changed
     - ✅ message_created
     - ✅ contact_created

### 3. Testar integração

Envie uma mensagem de teste no Chatwoot e verifique se o lead foi criado automaticamente no CRM.

## 📁 Estrutura do Projeto

\`\`\`
mds-crm-nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (landing)/         # Landing page pública
│   │   ├── api/               # API Routes
│   │   │   ├── auth/          # NextAuth endpoints
│   │   │   ├── leads/         # CRUD de leads
│   │   │   ├── projects/      # CRUD de projetos
│   │   │   └── webhooks/      # Webhooks (Chatwoot, Stripe)
│   │   ├── auth/              # Páginas de autenticação
│   │   ├── dashboard/         # Dashboard principal
│   │   └── layout.tsx         # Layout raiz
│   ├── components/            # Componentes React
│   │   ├── dashboard/         # Componentes do dashboard
│   │   ├── leads/             # Componentes de leads
│   │   └── ui/                # shadcn/ui components
│   ├── lib/                   # Utilities e helpers
│   │   ├── prisma.ts          # Prisma client
│   │   ├── auth.ts            # NextAuth config
│   │   ├── chatwoot.ts        # Chatwoot API client
│   │   └── gemini.ts          # Google Gemini client
│   └── types/                 # TypeScript types
├── prisma/
│   └── schema.prisma          # Database schema
├── public/
│   └── images/                # Assets estáticos
├── .env.example               # Template de variáveis
├── Dockerfile                 # Docker config
├── docker-compose.yml         # Docker Compose
├── package.json               # Dependencies
└── README.md                  # Este arquivo
\`\`\`

## 🔐 Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| \`DATABASE_URL\` | URL de conexão PostgreSQL | \`postgresql://user:pass@host:5432/db\` |
| \`NEXTAUTH_SECRET\` | Secret para NextAuth | \`openssl rand -base64 32\` |
| \`NEXTAUTH_URL\` | URL pública do CRM | \`https://crm.mundodigitalsolucoes.com.br\` |

### Chatwoot (Recomendado)

| Variável | Descrição |
|----------|-----------|
| \`CHATWOOT_API_URL\` | URL da API do Chatwoot |
| \`CHATWOOT_API_KEY\` | Token de API |
| \`CHATWOOT_ACCOUNT_ID\` | ID da conta |

### IA (Opcional)

| Variável | Descrição |
|----------|-----------|
| \`GEMINI_API_KEY\` | API Key do Google Gemini |

### Pagamentos (Opcional)

| Variável | Descrição |
|----------|-----------|
| \`STRIPE_SECRET_KEY\` | Chave secreta Stripe |
| \`STRIPE_PUBLISHABLE_KEY\` | Chave pública Stripe |

## 🧪 Scripts Disponíveis

\`\`\`bash
npm run dev          # Desenvolvimento local
npm run build        # Build para produção
npm run start        # Iniciar em produção
npm run lint         # Linter
npx prisma studio    # Visualizar banco de dados
npx prisma generate  # Gerar Prisma Client
npx prisma db push   # Aplicar schema no banco
\`\`\`

## 📊 Planos e Preços

### 🚀 Starter - R$ 99/mês
- 5 usuários
- 100 leads
- 10 projetos
- Integração Chatwoot
- Suporte por email

### 💼 Professional - R$ 299/mês
- 20 usuários
- 1.000 leads
- 50 projetos
- IA avançada
- Suporte prioritário
- API access

### 🏢 Enterprise - Customizado
- Usuários ilimitados
- Leads ilimitados
- White label
- Infraestrutura dedicada
- Gerente de conta

## 🔧 Troubleshooting

### Erro de conexão com PostgreSQL

\`\`\`bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql
\`\`\`

### Erro ao fazer build

\`\`\`bash
# Limpar cache
rm -rf .next
npm run build
\`\`\`

### Problemas com Prisma

\`\`\`bash
# Regenerar Prisma Client
npx prisma generate
npx prisma db push
\`\`\`

## 🤝 Suporte

- **Email:** suporte@mundodigitalsolucoes.com.br
- **Website:** https://mundodigitalsolucoes.com.br
- **Chatwoot:** https://app.mundodigitalsolucoes.com.br
- **CRM:** https://crm.mundodigitalsolucoes.com.br

## 📄 Licença

Proprietário - Mundo Digital Soluções © 2025

---

**Desenvolvido com ❤️ pela equipe Mundo Digital Soluções**

🌐 **Links:**
- CRM: https://crm.mundodigitalsolucoes.com.br
- Chatwoot: https://app.mundodigitalsolucoes.com.br
- Site: https://mundodigitalsolucoes.com.br
