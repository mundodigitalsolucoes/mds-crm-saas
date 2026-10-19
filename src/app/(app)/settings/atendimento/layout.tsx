import { checkModulePage } from '@/lib/authorization/page';

/** Commercial page observation only. Integration configuration keeps its operational API guards. */
export default async function AtendimentoSettingsAccessLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'atendimento', permission: 'atendimento', action: 'view' });
  return <>{children}</>;
}
