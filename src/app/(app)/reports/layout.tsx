import { checkModulePage } from '@/lib/authorization/page';

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'marketing', permission: 'reports', action: 'view' });
  await checkModulePage({ module: 'vendas', permission: 'leads', action: 'view' });
  return children;
}
