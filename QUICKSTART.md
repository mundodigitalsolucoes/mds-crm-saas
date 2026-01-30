# 🚀 MDS CRM - Quick Start Guide

## O que foi criado?

Este projeto contém a estrutura completa do **MDS CRM** pronto para deploy!

### ✅ Estrutura Criada

```
mds-crm-nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API Routes
│   │   │   └── webhooks/      # Chatwoot webhook
│   │   ├── layout.tsx         # Layout principal
│   │   ├── page.tsx           # Página inicial
│   │   └── globals.css        # Estilos globais
│   ├── components/            # Componentes React
│   │   └── providers.tsx      # React Query Provider
│   ├── lib/                   # Utilitários
│   │   ├── prisma.ts         # Prisma Client
│   │   └── utils.ts          # Funções auxiliares
│   └── types/                # TypeScript types
│       └── index.ts          # Tipos do sistema
├── prisma/
│   └── schema.prisma         # Schema do banco completo
├── public/
│   └── images/               # Logos do Mundo Digital
│       ├── logo-dark.png
│       ├── logo-light.png
│       └── favicon.png
├── Dockerfile                # Docker para produção
├── docker-compose.yml        # Docker Compose local
├── package.json              # Dependências
├── tailwind.config.js        # Configuração Tailwind
├── next.config.js            # Configuração Next.js
├── .env.example              # Exemplo de variáveis
├── README.md                 # Documentação completa
└── DEPLOY.md                 # Guia de deploy Coolify
```

## 🎯 Próximos Passos

### 1. Subir para o GitHub

```bash
# Entre na pasta do projeto
cd mds-crm-nextjs

# Inicialize o Git
git init
git add .
git commit -m "Initial commit: MDS CRM com integração Chatwoot"

# Crie um repositório no GitHub e adicione:
git branch -M main
git remote add origin https://github.com/seu-usuario/mds-crm.git
git push -u origin main
```

### 2. Deploy no Coolify

Siga o guia completo em: **DEPLOY.md**

Resumo:
1. Conecte o repositório GitHub no Coolify
2. Adicione PostgreSQL no projeto
3. Configure variáveis de ambiente
4. Configure domínio: `crm.seudominio.com`
5. Faça deploy!

### 3. Configurar Chatwoot

1. Obtenha API Key do Chatwoot
2. Configure webhook apontando para: `https://crm.seudominio.com/api/webhooks/chatwoot`
3. Teste enviando mensagem

## 📋 Checklist de Implantação

- [ ] Código no GitHub
- [ ] Projeto criado no Coolify
- [ ] PostgreSQL configurado
- [ ] Variáveis de ambiente definidas
- [ ] Domínio configurado (DNS + SSL)
- [ ] Deploy realizado
- [ ] Migrations executadas (`npx prisma db push`)
- [ ] Webhook do Chatwoot configurado
- [ ] Teste de integração feito
- [ ] Usuário admin criado
- [ ] Backup configurado

## 🔧 Desenvolvimento Local (Opcional)

Se quiser testar localmente antes:

```bash
# Instalar dependências
npm install

# Configurar .env
cp .env.example .env
# Edite .env com suas credenciais

# Subir banco de dados local
docker-compose up -d postgres redis

# Executar migrations
npx prisma generate
npx prisma db push

# Iniciar servidor
npm run dev
```

Acesse: http://localhost:3000

## 🎨 Próximas Funcionalidades a Desenvolver

Você tem a estrutura base. Agora pode adicionar:

### Módulos Core (Prioritário)
- [ ] **Dashboard** - Criar componentes de gráficos
- [ ] **Leads** - Página de listagem e formulários
- [ ] **Projetos** - CRUD completo
- [ ] **Kanban** - Implementar drag-and-drop
- [ ] **Tarefas** - Sistema de gerenciamento
- [ ] **Relatórios** - Geração e exportação

### Autenticação
- [ ] Configurar NextAuth.js
- [ ] Página de login
- [ ] Proteção de rotas
- [ ] Roles de usuário

### Integrações
- [x] Webhook Chatwoot (Criado!)
- [ ] API para buscar conversas
- [ ] Integração com Gemini para IA
- [ ] Exportação de relatórios

### Melhorias
- [ ] Testes unitários
- [ ] Notificações em tempo real
- [ ] Upload de arquivos
- [ ] Busca global
- [ ] Filtros avançados

## 📚 Recursos Úteis

- **Documentação Next.js:** https://nextjs.org/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Chatwoot API:** https://www.chatwoot.com/docs/product/channels/api/client-apis
- **TailwindCSS:** https://tailwindcss.com/docs

## 🆘 Precisa de Ajuda?

### Comandos Úteis

```bash
# Ver logs do container
docker logs -f mds-crm-app

# Acessar banco de dados
npx prisma studio

# Executar migrations
npx prisma db push

# Build de produção
npm run build

# Verificar erros
npm run lint
```

### Problemas Comuns

**Erro de conexão com banco:**
- Verifique DATABASE_URL no .env
- Certifique que PostgreSQL está rodando

**Build falha:**
- Verifique se todas dependências estão instaladas
- Execute `npm install` novamente

**Chatwoot não sincroniza:**
- Verifique URL do webhook
- Teste: `curl -X POST https://crm.seudominio.com/api/webhooks/chatwoot`
- Veja logs no Coolify

## 🎉 Está Pronto!

Seu CRM tem:
✅ Estrutura Next.js 14 profissional
✅ Schema PostgreSQL completo
✅ Integração com Chatwoot configurada
✅ Docker pronto para produção
✅ Logos do Mundo Digital integradas
✅ Documentação completa

**Agora é só subir pro GitHub e fazer deploy no Coolify!**

---

**Mundo Digital - Soluções em Marketing e Vendas**
