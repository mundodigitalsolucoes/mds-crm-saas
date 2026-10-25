import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { checkAuth } from "@/lib/checkPermission";
import { getOrgBranding } from "@/lib/branding";

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
});

const defaultMetadata: Metadata = {
  title: "MDS CRM - Mundo Digital",
  description: "Sistema de Gestão de Leads e Projetos",
  icons: { icon: "/images/favicon.png", shortcut: "/images/favicon.png" },
};

// Root also owns the 404 metadata. Resolve only a validated existing session;
// anonymous login never accepts a tenant identifier from the URL or cookies.
export async function generateMetadata(): Promise<Metadata> {
  if (process.env.CRM_CUSTOM_DOMAINS_ENABLED === 'true') {
    const { publicDomainBranding } = await import('@/lib/domains/request');
    const brand = await publicDomainBranding();
    if (brand) return { ...defaultMetadata, title: brand.name, icons: { icon: brand.favicon!, shortcut: brand.favicon! } };
  }
  const auth = await checkAuth();
  if (!auth.authenticated || !auth.session) return defaultMetadata;
  const brand = await getOrgBranding(auth.session.user.organizationId);
  return { ...defaultMetadata, title: brand.name, icons: { icon: brand.favicon!, shortcut: brand.favicon! } };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
