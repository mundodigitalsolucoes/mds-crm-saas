import { checkModulePage } from '@/lib/authorization/page';

export default async function AtendimentoAccessLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'atendimento', permission: 'atendimento', action: 'view' });
  return <>{children}</>;
}
