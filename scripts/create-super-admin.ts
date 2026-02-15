import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * Script para criar o primeiro SuperAdmin no banco
 * Uso: npx tsx scripts/create-super-admin.ts
 */

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@mdscrm.com';
  const password = 'Admin@2024!';
  const name = 'Super Admin';

  console.log('🔧 Criando SuperAdmin...\n');

  // Verifica se já existe
  const existing = await prisma.superAdmin.findUnique({
    where: { email },
  });

  if (existing) {
    console.log('⚠️  SuperAdmin já existe com este email.');
    console.log(`   Email: ${email}`);
    console.log('   Nenhuma alteração feita.\n');
    return;
  }

  // Gera hash da senha
  const passwordHash = await bcrypt.hash(password, 12);

  // Cria o SuperAdmin
  const admin = await prisma.superAdmin.create({
    data: {
      email,
      passwordHash,
      name,
    },
  });

  console.log('✅ SuperAdmin criado com sucesso!\n');
  console.log('   ┌─────────────────────────────────────┐');
  console.log(`   │  ID:    ${admin.id}`);
  console.log(`   │  Nome:  ${admin.name}`);
  console.log(`   │  Email: ${admin.email}`);
  console.log(`   │  Senha: ${password}`);
  console.log('   └─────────────────────────────────────┘');
  console.log('\n🔒 IMPORTANTE: Troque a senha após o primeiro login!\n');
}

main()
  .catch((error) => {
    console.error('❌ Erro ao criar SuperAdmin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
