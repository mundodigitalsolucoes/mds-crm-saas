import { checkModulePage } from '@/lib/authorization/page';

export default async function CommercialLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'marketing', permission: 'os', action: 'view' });
  return children;
}
