# MDS CRM - Inteligência em Marketing e Vendas

Sistema completo de CRM desenvolvido com Next.js 14, PostgreSQL e integração nativa com Chatwoot.

## 🚀 Funcionalidades

- ✅ **Dashboard** - Métricas em tempo real e KPIs
- ✅ **Gestão de Leads** - Pipeline visual com kanban
- ✅ **Projetos de Marketing** - Controle de campanhas e ROI
- ✅ **Kanban Boards** - Gestão visual de tarefas
- ✅ **Sistema de Tarefas** - Atribuição e acompanhamento
- ✅ **Relatórios** - Análises e exportação
- ✅ **Integração Chatwoot** - Sincronização automática de conversas
- ✅ **IA com Gemini** - Scoring e análise de leads

## 🛠️ Stack Tecnológica

- **Frontend:** Next.js 14 (App Router), React 18, TailwindCSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** PostgreSQL 15+
- **Cache:** Redis (opcional)
- **Auth:** NextAuth.js
- **Charts:** Recharts
- **State:** Zustand
- **Validation:** Zod

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 15+
- Git

## 🏁 Instalação Local

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/mds-crm.git
cd mds-crm
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o banco de dados

Crie um banco PostgreSQL:

```sql
CREATE DATABASE mds_crm;
```

### 4. Configure as variáveis de ambiente

Copie o arquivo de exemplo e edite com suas credenciais:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/mds_crm"
NEXTAUTH_SECRET="gere-uma-chave-secreta-aqui"
NEXTAUTH_URL="http://localhost:3000"

# Chatwoot (opcional)
CHATWOOT_API_URL="https://seu-chatwoot.com/api/v1"
CHATWOOT_API_KEY="sua-api-key"
CHATWOOT_ACCOUNT_ID="seu-account-id"
```

### 5. Execute as migrations do Prisma

```bash
npx prisma generate
npx prisma db push
```

### 6. (Opcional) Popule o banco com dados de teste

```bash
npx prisma db seed
```

### 7. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse: http://localhost:3000

## 🔐 Primeiro Acesso

**Usuário padrão:**
- Email: admin@mds.com.br
- Senha: admin123

⚠️ **IMPORTANTE:** Altere a senha após o primeiro login!

## 🐳 Deploy com Docker (Coolify)

### 1. Crie um Dockerfile

O projeto já inclui um `Dockerfile` otimizado.

### 2. Configure no Coolify

1. Acesse seu painel do Coolify
2. Crie um novo projeto
3. Conecte seu repositório Git
4. Selecione "Next.js Application"
5. Configure as variáveis de ambiente
6. Adicione um serviço PostgreSQL
7. Faça o deploy

### 3. Variáveis de Ambiente no Coolify

Adicione no painel do Coolify:

```env
DATABASE_URL=postgresql://user:pass@postgres:5432/mds_crm
NEXTAUTH_SECRET=[gerar com: openssl rand -base64 32]
NEXTAUTH_URL=https://crm.seudominio.com
CHATWOOT_API_URL=https://chatwoot.seudominio.com/api/v1
CHATWOOT_API_KEY=sua-chave-api
CHATWOOT_ACCOUNT_ID=seu-id
```

### 4. Configurar Domínio

No Coolify:
1. Vá em "Domains"
2. Adicione: `crm.seudominio.com`
3. O SSL será gerado automaticamente

## 🔗 Integração com Chatwoot

### 1. Obter credenciais do Chatwoot

1. Acesse seu Chatwoot
2. Vá em: Settings → Integrations → API
3. Gere uma Access Token
4. Anote seu Account ID

### 2. Configurar Webhook

No Chatwoot:
1. Settings → Integrations → Webhooks
2. Adicione novo webhook:
   - **URL:** `https://crm.seudominio.com/api/webhooks/chatwoot`
   - **Eventos:** 
     - `conversation_created`
     - `message_created`
     - `contact_created`
     - `conversation_status_changed`

### 3. Testar Integração

Envie uma mensagem no Chatwoot e verifique se o lead foi criado automaticamente no CRM.

## 📊 Estrutura do Projeto

```
mds-crm/
├── src/
│   ├── app/              # Pages (App Router)
│   │   ├── api/          # API routes
│   │   ├── dashboard/    # Dashboard page
│   │   ├── leads/        # Leads management
│   │   ├── projects/     # Marketing projects
│   │   ├── kanban/       # Kanban boards
│   │   ├── tasks/        # Tasks
│   │   ├── reports/      # Reports
│   │   └── auth/         # Authentication
│   ├── components/       # React components
│   ├── lib/             # Utilities
│   └── types/           # TypeScript types
├── prisma/
│   └── schema.prisma    # Database schema
├── public/
│   └── images/          # Static assets
└── package.json
```

## 🧪 Scripts Disponíveis

```bash
npm run dev         # Desenvolvimento
npm run build       # Build para produção
npm run start       # Iniciar em produção
npm run lint        # Linter
npx prisma studio   # Interface visual do banco
```

## 📱 Recursos Adicionais

### Backup do Banco de Dados

```bash
pg_dump mds_crm > backup.sql
```

### Restaurar Backup

```bash
psql mds_crm < backup.sql
```

### Visualizar Banco de Dados

```bash
npx prisma studio
```

Abre em: http://localhost:5555

## 🔧 Troubleshooting

### Erro de conexão com PostgreSQL

Verifique se o PostgreSQL está rodando:

```bash
sudo systemctl status postgresql
```

### Erro ao fazer build

Limpe o cache:

```bash
rm -rf .next
npm run build
```

### Problemas com Prisma

Regenere o client:

```bash
npx prisma generate
```

## 📝 Próximos Passos

1. ✅ Completar todos os módulos
2. ✅ Adicionar testes unitários
3. ✅ Implementar notificações em tempo real
4. ✅ Adicionar mais integrações
5. ✅ Dashboard de analytics avançado

## 🤝 Suporte

- Email: contato@mundodigitalsolucoes.com.br
- Website: https://www.mundodigitalsolucoes.com.br

## 📄 Licença

Proprietário - Mundo Digital © 2025

---

Desenvolvido com ❤️ pela equipe Mundo Digital
