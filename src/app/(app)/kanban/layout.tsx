import { checkModulePage } from '@/lib/authorization/page';

export default async function SalesPipelineAccessLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'vendas', permission: 'kanban', action: 'view' });
  return <>{children}</>;
}
