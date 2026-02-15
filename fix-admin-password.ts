import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('Admin@2024!', 12);
  
  const admin = await prisma.superAdmin.updateMany({
    where: { email: 'admin@mdscrm.com' },
    data: { passwordHash: hash },
  });
  
  console.log('Registros atualizados:', admin.count);
  console.log('Hash gerado:', hash);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
