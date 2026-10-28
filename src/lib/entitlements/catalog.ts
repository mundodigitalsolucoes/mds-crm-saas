/** Commercial identifiers, independent of user permission modules and providers. */
export type FeatureKind = 'module' | 'capability' | 'channel' | 'addon';
export type Availability = 'available' | 'planned';

function feature<K extends FeatureKind, A extends Availability>(
  kind: K, availability: A, label: string, description: string,
  resources: readonly string[] = [],
) {
  return { kind, availability, label, description, resources } as const;
}

export const FEATURE_CATALOG = {
  atendimento: feature('module', 'available', 'Atendimento', 'Operação de atendimento ao cliente.'),
  vendas: feature('module', 'available', 'Vendas', 'Operação comercial e pipeline de vendas.'),
  marketing: feature('module', 'available', 'Marketing', 'Gestão de projetos e campanhas.'),
  financeiro: feature('module', 'planned', 'Financeiro', 'Módulo futuro, ainda indisponível.'),
  agentes_ia: feature('module', 'planned', 'Agentes de IA', 'Módulo futuro, ainda indisponível.'),
  white_label: feature('capability', 'available', 'White Label', 'Direito comercial à personalização; não aplica branding.'),
  custom_domain: feature('capability', 'available', 'Domínio próprio', 'Hostname exclusivo, com posse e HTTPS verificados; não habilita módulos nem White-Label.'),
  advanced_reports: feature('capability', 'available', 'Relatórios Avançados', 'Capacidade opcional de relatórios.'),
  integrations: feature('capability', 'available', 'Integrações', 'Capacidade comercial; não concede permissão de usuário.'),
  ai_assistant: feature('capability', 'available', 'Assistente IA', 'Identificador legado, distinto do futuro módulo agentes_ia.'),
  priority_support: feature('capability', 'available', 'Suporte prioritário', 'Benefício comercial de suporte.'),
  whatsapp: feature('channel', 'available', 'WhatsApp', 'Tipo comercial de canal; não identifica provider.', ['connections']),
  instagram_channel: feature('channel', 'available', 'Instagram', 'Canal Instagram.', ['connections']),
  email_channel: feature('channel', 'available', 'E-mail', 'Canal de e-mail.', ['connections']),
  site_widget: feature('channel', 'available', 'Widget do Site', 'Canal do widget do site.', ['connections']),
  google_business_channel: feature('channel', 'available', 'Google Business', 'Canal Google Business.', ['connections']),
  extra_whatsapp_addon: feature('addon', 'available', 'Número extra de WhatsApp', 'Adicional de conexões.', ['connections']),
  extra_user_addon: feature('addon', 'available', 'Usuário extra', 'Adicional de usuários.', ['users']),
  extra_ai_addon: feature('addon', 'available', 'Créditos extras de IA', 'Adicional de créditos.', ['ai_credits']),
} as const;

export type FeatureId = keyof typeof FEATURE_CATALOG;
export type FeatureIdOf<K extends FeatureKind> = {
  [I in FeatureId]: (typeof FEATURE_CATALOG)[I]['kind'] extends K ? I : never
}[FeatureId];
export type CommercialModuleId = FeatureIdOf<'module'>;
export type CapabilityId = FeatureIdOf<'capability'>;
export type ChannelId = FeatureIdOf<'channel'>;
export type AddonId = FeatureIdOf<'addon'>;

export function isFeatureId(value: string): value is FeatureId {
  return Object.prototype.hasOwnProperty.call(FEATURE_CATALOG, value);
}

export function featuresOfKind<K extends FeatureKind>(kind: K): FeatureIdOf<K>[] {
  return (Object.keys(FEATURE_CATALOG) as FeatureId[])
    .filter((id) => FEATURE_CATALOG[id].kind === kind) as FeatureIdOf<K>[];
}
