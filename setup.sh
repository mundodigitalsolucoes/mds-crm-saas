#!/bin/bash

# 🚀 MDS CRM - Script de Setup Inicial
# Execute: chmod +x setup.sh && ./setup.sh

set -e

echo "🚀 Iniciando setup do MDS CRM..."
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar Node.js
echo "📦 Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não encontrado!${NC}"
    echo "Por favor, instale Node.js 18+ em: https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✅ Node.js $NODE_VERSION instalado${NC}"
echo ""

# Verificar npm
echo "📦 Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm não encontrado!${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✅ npm $NPM_VERSION instalado${NC}"
echo ""

# Instalar dependências
echo "📦 Instalando dependências..."
npm install
echo -e "${GREEN}✅ Dependências instaladas${NC}"
echo ""

# Verificar .env
echo "🔐 Configurando variáveis de ambiente..."
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Criando a partir do .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
    echo -e "${YELLOW}⚠️  IMPORTANTE: Edite o arquivo .env com suas credenciais!${NC}"
else
    echo -e "${GREEN}✅ Arquivo .env já existe${NC}"
fi
echo ""

# Gerar NEXTAUTH_SECRET
echo "🔑 Gerando NEXTAUTH_SECRET..."
if command -v openssl &> /dev/null; then
    SECRET=$(openssl rand -base64 32)
    echo -e "${GREEN}✅ NEXTAUTH_SECRET gerado:${NC}"
    echo -e "${YELLOW}$SECRET${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  Copie e cole no arquivo .env na variável NEXTAUTH_SECRET${NC}"
else
    echo -e "${YELLOW}⚠️  openssl não encontrado. Gere manualmente com:${NC}"
    echo "   openssl rand -base64 32"
fi
echo ""

# Verificar PostgreSQL
echo "🗄️  Verificando PostgreSQL..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✅ PostgreSQL instalado${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL não encontrado localmente${NC}"
    echo "   Para desenvolvimento local, instale PostgreSQL 15+"
    echo "   Ou use Docker: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15"
fi
echo ""

# Prisma
echo "🔧 Configurando Prisma..."
if [ -f .env ]; then
    read -p "Executar prisma generate? (s/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        npx prisma generate
        echo -e "${GREEN}✅ Prisma Client gerado${NC}"
        
        read -p "Executar prisma db push? (s/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            npx prisma db push
            echo -e "${GREEN}✅ Schema aplicado no banco de dados${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Configure .env antes de executar Prisma${NC}"
fi
echo ""

# Git
echo "📝 Verificando Git..."
if command -v git &> /dev/null; then
    echo -e "${GREEN}✅ Git instalado${NC}"
    
    if [ ! -d .git ]; then
        read -p "Inicializar repositório Git? (s/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Ss]$ ]]; then
            git init
            git add .
            git commit -m "feat: Initial commit - MDS CRM SaaS"
            echo -e "${GREEN}✅ Repositório Git inicializado${NC}"
        fi
    else
        echo -e "${GREEN}✅ Repositório Git já existe${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Git não encontrado. Instale para versionamento de código${NC}"
fi
echo ""

# Checklist final
echo "📋 Checklist de Setup:"
echo ""
echo "✅ Passos Concluídos:"
echo "  - Node.js e npm instalados"
echo "  - Dependências instaladas"
echo "  - Arquivo .env criado"
echo ""
echo "⚠️  Próximos Passos:"
echo "  1. Editar .env com suas credenciais"
echo "  2. Configurar PostgreSQL (local ou Docker)"
echo "  3. Executar: npx prisma db push"
echo "  4. Executar: npm run dev"
echo "  5. Acessar: http://localhost:3000"
echo ""
echo "📚 Documentação:"
echo "  - README.md - Visão geral"
echo "  - DEPLOY-COOLIFY.md - Deploy em produção"
echo "  - GIT-COMMANDS.md - Comandos Git"
echo ""
echo "🚀 Setup concluído!"
echo ""

# Perguntar se quer abrir editor
read -p "Abrir .env no editor? (s/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    if command -v code &> /dev/null; then
        code .env
    elif command -v nano &> /dev/null; then
        nano .env
    elif command -v vim &> /dev/null; then
        vim .env
    else
        echo "Abra manualmente: .env"
    fi
fi

echo ""
echo -e "${GREEN}✨ Bom desenvolvimento!${NC}"
