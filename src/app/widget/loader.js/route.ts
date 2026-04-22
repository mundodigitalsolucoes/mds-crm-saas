import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const script = `
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__MDS_ATENDIMENTO_WIDGET_LOADER_ACTIVE__) return;
  window.__MDS_ATENDIMENTO_WIDGET_LOADER_ACTIVE__ = true;

  const inlineConfig = window.MDSAtendimentoWidget || {};
  const orgSlug =
    inlineConfig.orgSlug ||
    inlineConfig.slug ||
    inlineConfig.organizationSlug ||
    '';

  if (!orgSlug) {
    console.warn('[MDS Widget] orgSlug não informado no snippet.');
    return;
  }

  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="/widget/loader.js"]');

  let crmBaseUrl = 'https://crm.mundodigitalsolucoes.com.br';

  try {
    if (currentScript && currentScript.src) {
      crmBaseUrl = new URL(currentScript.src).origin;
    }
  } catch {}

  function normalizeDomain(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\\/\\//, '')
      .replace(/\\/$/, '');
  }

  function getCurrentHost() {
    try {
      return normalizeDomain(window.location.hostname);
    } catch {
      return '';
    }
  }

  function domainMatches(currentHost, allowedDomain) {
    const normalizedCurrent = normalizeDomain(currentHost);
    const normalizedAllowed = normalizeDomain(allowedDomain);

    if (!normalizedCurrent || !normalizedAllowed) return false;
    if (normalizedCurrent === normalizedAllowed) return true;

    return normalizedCurrent.endsWith('.' + normalizedAllowed);
  }

  function isDomainAllowed(config) {
    const mode = config.publishMode === 'allowlist' ? 'allowlist' : 'all';

    if (mode === 'all') return true;

    const allowedDomains = Array.isArray(config.allowedDomains)
      ? config.allowedDomains
      : [];

    const currentHost = getCurrentHost();

    if (!currentHost) return false;

    return allowedDomains.some((domain) => domainMatches(currentHost, domain));
  }

  function buildChatwootSettings(config) {
    const launcherType =
      config.launcherType === 'expanded' ? 'expanded_bubble' : 'standard';

    const settings = {
      position: config.position === 'left' ? 'left' : 'right',
      locale: String(config.locale || 'pt_BR'),
      useBrowserLanguage: Boolean(config.useBrowserLanguage),
      type: launcherType,
      darkMode: config.darkMode === 'light' ? 'light' : 'auto',
    };

    if (launcherType === 'expanded_bubble' && String(config.launcherTitle || '').trim()) {
      settings.launcherTitle = String(config.launcherTitle).trim();
    }

    return settings;
  }

  function loadChatwootSdk(params) {
    const baseUrl = String(params.baseUrl || '').trim().replace(/\\/$/, '');
    const websiteToken = String(params.websiteToken || '').trim();

    if (!baseUrl || !websiteToken) {
      console.warn('[MDS Widget] baseUrl ou websiteToken ausente.');
      return;
    }

    if (window.__MDS_CHATWOOT_WIDGET_RUNNING__) {
      return;
    }

    window.chatwootSettings = buildChatwootSettings(params.config);

    const sdkUrl = baseUrl + '/packs/js/sdk.js';
    const existingSdk = document.querySelector('script[data-mds-chatwoot-sdk="true"]');

    function boot() {
      if (
        window.chatwootSDK &&
        typeof window.chatwootSDK.run === 'function' &&
        !window.__MDS_CHATWOOT_WIDGET_RUNNING__
      ) {
        window.__MDS_CHATWOOT_WIDGET_RUNNING__ = true;
        window.chatwootSDK.run({
          websiteToken,
          baseUrl,
        });
      }
    }

    if (existingSdk) {
      if (window.chatwootSDK && typeof window.chatwootSDK.run === 'function') {
        boot();
        return;
      }

      existingSdk.addEventListener('load', boot, { once: true });
      return;
    }

    const scriptTag = document.createElement('script');
    scriptTag.src = sdkUrl;
    scriptTag.defer = true;
    scriptTag.async = true;
    scriptTag.dataset.mdsChatwootSdk = 'true';
    scriptTag.addEventListener('load', boot, { once: true });
    document.head.appendChild(scriptTag);
  }

  async function bootstrap() {
    try {
      const response = await fetch(
        \`\${crmBaseUrl}/api/public/widget/\${encodeURIComponent(orgSlug)}\`,
        {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
          cache: 'no-store',
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.warn('[MDS Widget] Não foi possível carregar configuração pública.', payload);
        return;
      }

      if (!payload || !payload.config) {
        console.warn('[MDS Widget] Configuração pública vazia.');
        return;
      }

      const config = payload.config;

      if (!config.enabled) {
        console.warn('[MDS Widget] Widget desativado para esta organização.');
        return;
      }

      if (!isDomainAllowed(config)) {
        console.warn('[MDS Widget] Domínio atual não autorizado para este widget.');
        return;
      }

      loadChatwootSdk({
        baseUrl: config.chatwootBaseUrl,
        websiteToken: config.websiteToken,
        config,
      });
    } catch (error) {
      console.warn('[MDS Widget] Falha ao inicializar widget.', error);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    void bootstrap();
  }
})();
`.trim()

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}