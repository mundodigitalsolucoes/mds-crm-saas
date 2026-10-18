import { checkModulePage } from '@/lib/authorization/page';

export default async function ProjectsAccessLayout({ children }: { children: React.ReactNode }) {
  await checkModulePage({ module: 'marketing', permission: 'projects', action: 'view' });
  return <>{children}</>;
}
