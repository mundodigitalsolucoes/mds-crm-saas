import { checkModulePage } from '@/lib/authorization/page';

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'marketing', permission: 'tasks', action: 'view' });
  return children;
}
