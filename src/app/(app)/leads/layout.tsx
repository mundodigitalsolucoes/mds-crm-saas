import { checkModulePage } from '@/lib/authorization/page';

export default async function LeadsAccessLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'vendas', permission: 'leads', action: 'view' });
  return <>{children}</>;
}
