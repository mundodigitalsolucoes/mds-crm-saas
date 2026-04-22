import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const script = `
(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__MDS_ATENDIMENTO_WIDGET_LOADED__) return;
  window.__MDS_ATENDIMENTO_WIDGET_LOADED__ = true;

  const inlineConfig = window.MDSAtendimentoWidget || {};
  const orgSlug =
    inlineConfig.orgSlug ||
    inlineConfig.slug ||
    inlineConfig.organizationSlug ||
    '';

  const pageContext = String(
    inlineConfig.pageContext ||
      inlineConfig.context ||
      inlineConfig.scenario ||
      'default'
  ).trim();

  if (!orgSlug) {
    console.warn('[MDS Widget] orgSlug não informado no snippet.');
    return;
  }

  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="/widget/loader.js"]');

  let baseUrl = 'https://crm.mundodigitalsolucoes.com.br';

  try {
    if (currentScript && currentScript.src) {
      baseUrl = new URL(currentScript.src).origin;
    }
  } catch {}

  const styleId = 'mds-attendimento-widget-styles';

  function injectStyles() {
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = \`
      .mds-aw-root {
        --mds-aw-primary: #374b89;
        --mds-aw-accent: #2f3453;
        position: fixed;
        bottom: 24px;
        z-index: 2147483000;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .mds-aw-root.right {
        right: 24px;
      }

      .mds-aw-root.left {
        left: 24px;
      }

      .mds-aw-stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: flex-end;
      }

      .mds-aw-root.left .mds-aw-stack {
        align-items: flex-start;
      }

      .mds-aw-panel {
        width: 340px;
        max-width: calc(100vw - 32px);
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 24px;
        box-shadow: 0 20px 45px rgba(15, 23, 42, 0.18);
        overflow: hidden;
        display: none;
      }

      .mds-aw-panel.open {
        display: block;
      }

      .mds-aw-header {
        background: var(--mds-aw-accent);
        color: #ffffff;
        padding: 16px 18px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .mds-aw-org {
        font-size: 14px;
        font-weight: 700;
        line-height: 1.2;
      }

      .mds-aw-status {
        margin-top: 6px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #e2e8f0;
      }

      .mds-aw-status-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #34d399;
      }

      .mds-aw-status-dot.offline {
        background: #fbbf24;
      }

      .mds-aw-close {
        background: transparent;
        border: 0;
        color: #cbd5e1;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 0;
      }

      .mds-aw-content {
        padding: 20px 18px 18px;
      }

      .mds-aw-title {
        color: #2f3453;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.3;
        margin: 0;
      }

      .mds-aw-subtitle {
        color: #475569;
        font-size: 14px;
        line-height: 1.7;
        margin: 10px 0 0;
      }

      .mds-aw-cta {
        margin-top: 18px;
        display: inline-flex;
        width: 100%;
        align-items: center;
        justify-content: center;
        gap: 10px;
        background: var(--mds-aw-primary);
        color: #ffffff;
        text-decoration: none;
        border-radius: 18px;
        padding: 14px 16px;
        font-size: 14px;
        font-weight: 700;
        box-sizing: border-box;
      }

      .mds-aw-note {
        margin-top: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        color: #64748b;
        font-size: 12px;
        line-height: 1.7;
        padding: 12px 13px;
      }

      .mds-aw-button {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: var(--mds-aw-primary);
        color: #ffffff;
        border: 0;
        border-radius: 999px;
        padding: 16px 20px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.22);
      }

      .mds-aw-icon {
        font-size: 18px;
        line-height: 1;
      }

      @media (max-width: 640px) {
        .mds-aw-root {
          left: 16px !important;
          right: 16px !important;
          bottom: 16px;
        }

        .mds-aw-stack {
          align-items: stretch !important;
        }

        .mds-aw-panel {
          width: 100%;
          max-width: 100%;
        }

        .mds-aw-button {
          width: fit-content;
          max-width: 100%;
          align-self: flex-end;
        }
      }
    \`;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normalizeHex(value, fallback) {
    const text = String(value || '').trim();
    return /^#([0-9A-Fa-f]{6})$/.test(text) ? text : fallback;
  }

  function normalizeContext(value) {
    return String(value || '').trim().toLowerCase();
  }

  function toMinutes(time) {
    const parts = String(time || '00:00').split(':');
    const hours = Number(parts[0] || 0);
    const minutes = Number(parts[1] || 0);
    return hours * 60 + minutes;
  }

  function getCurrentDayAndMinutes(timezone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'America/Sao_Paulo',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      const parts = formatter.formatToParts(new Date());
      const weekday = (parts.find((part) => part.type === 'weekday')?.value || '').toLowerCase();
      const hour = Number(parts.find((part) => part.type === 'hour')?.value || '0');
      const minute = Number(parts.find((part) => part.type === 'minute')?.value || '0');

      return {
        weekday,
        minutes: hour * 60 + minute,
      };
    } catch {
      return {
        weekday: '',
        minutes: 0,
      };
    }
  }

  function resolveDayKey(weekday) {
    const map = {
      monday: 'monday',
      tuesday: 'tuesday',
      wednesday: 'wednesday',
      thursday: 'thursday',
      friday: 'friday',
      saturday: 'saturday',
      sunday: 'sunday',
    };

    return map[weekday] || null;
  }

  function resolveTarget(config, context) {
    const targetSlots = config.targetSlots || {};
    const rules = Array.isArray(config.contextRules) ? config.contextRules : [];
    const normalizedContext = normalizeContext(context);

    const matchedRule = rules.find((rule) => normalizeContext(rule.context) === normalizedContext);
    const targetKey = matchedRule?.targetKey || 'default';

    const selected = targetSlots[targetKey] || null;
    const fallback = targetSlots.default || null;

    if (selected && selected.enabled && String(selected.url || '').trim()) {
      return {
        label: String(selected.label || config.ctaLabel || 'Abrir Atendimento').trim(),
        url: String(selected.url || '').trim(),
      };
    }

    if (fallback && String(fallback.url || '').trim()) {
      return {
        label: String(fallback.label || config.ctaLabel || 'Abrir Atendimento').trim(),
        url: String(fallback.url || '').trim(),
      };
    }

    return {
      label: String(config.ctaLabel || 'Abrir Atendimento').trim(),
      url: String(config.primaryActionUrl || '').trim(),
    };
  }

  function resolveWidgetState(config) {
    const operatingMode = config.operatingMode === 'business_hours' ? 'business_hours' : 'manual';
    const fallbackBehavior = config.fallbackBehavior === 'redirect' ? 'redirect' : 'none';
    const fallbackUrl = String(config.fallbackUrl || '').trim();
    const fallbackLabel = String(config.fallbackLabel || '').trim();

    let isOnline = Boolean(config.online);

    if (operatingMode === 'business_hours') {
      const current = getCurrentDayAndMinutes(config.timezone);
      const dayKey = resolveDayKey(current.weekday);
      const day = dayKey && config.businessHours ? config.businessHours[dayKey] : null;

      isOnline =
        Boolean(day && day.enabled) &&
        current.minutes >= toMinutes(day.start) &&
        current.minutes <= toMinutes(day.end);
    }

    const resolvedTarget = resolveTarget(config, pageContext);

    if (isOnline) {
      return {
        online: true,
        actionUrl: resolvedTarget.url,
        actionLabel: resolvedTarget.label,
        helperText:
          'Widget carregado em modo operacional. O destino foi resolvido pelo contexto da página.',
        statusText: 'Atendimento disponível',
      };
    }

    if (fallbackBehavior === 'redirect' && fallbackUrl) {
      return {
        online: false,
        actionUrl: fallbackUrl,
        actionLabel: fallbackLabel || 'Abrir opção alternativa',
        helperText:
          'Fora do horário. O CTA foi redirecionado para o fallback configurado.',
        statusText: 'Fora do horário',
      };
    }

    return {
      online: false,
      actionUrl: resolvedTarget.url,
      actionLabel: resolvedTarget.label,
      helperText:
        'Fora do horário. Sem fallback configurado, o destino do contexto foi mantido.',
      statusText: 'Fora do horário',
    };
  }

  function createWidget(config) {
    const existing = document.getElementById('mds-aw-root');
    if (existing) existing.remove();

    const resolved = resolveWidgetState(config);

    const root = document.createElement('div');
    root.id = 'mds-aw-root';
    root.className = 'mds-aw-root ' + (config.position === 'left' ? 'left' : 'right');
    root.style.setProperty('--mds-aw-primary', normalizeHex(config.primaryColor, '#374b89'));
    root.style.setProperty('--mds-aw-accent', normalizeHex(config.accentColor, '#2f3453'));

    const stack = document.createElement('div');
    stack.className = 'mds-aw-stack';

    const panel = document.createElement('div');
    panel.className = 'mds-aw-panel';

    panel.innerHTML = \`
      <div class="mds-aw-header">
        <div>
          <div class="mds-aw-org">\${escapeHtml(config.organizationName)}</div>
          <div class="mds-aw-status">
            <span class="mds-aw-status-dot \${resolved.online ? '' : 'offline'}"></span>
            \${resolved.statusText}
          </div>
        </div>
        <button class="mds-aw-close" type="button" aria-label="Fechar">×</button>
      </div>
      <div class="mds-aw-content">
        <h3 class="mds-aw-title">\${escapeHtml(config.title)}</h3>
        <p class="mds-aw-subtitle">\${escapeHtml(config.subtitle)}</p>
        <a
          class="mds-aw-cta"
          href="\${escapeHtml(resolved.actionUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="mds-aw-icon">💬</span>
          \${escapeHtml(resolved.actionLabel)}
        </a>
        <div class="mds-aw-note">
          \${escapeHtml(resolved.helperText)}
        </div>
      </div>
    \`;

    const bubble = document.createElement('button');
    bubble.type = 'button';
    bubble.className = 'mds-aw-button';
    bubble.innerHTML = \`
      <span class="mds-aw-icon">💬</span>
      <span>\${escapeHtml(config.buttonLabel)}</span>
    \`;

    const closeButton = panel.querySelector('.mds-aw-close');

    function openPanel() {
      panel.classList.add('open');
    }

    function closePanel() {
      panel.classList.remove('open');
    }

    bubble.addEventListener('click', () => {
      if (panel.classList.contains('open')) {
        closePanel();
        return;
      }

      openPanel();
    });

    if (closeButton) {
      closeButton.addEventListener('click', closePanel);
    }

    stack.appendChild(panel);
    stack.appendChild(bubble);
    root.appendChild(stack);
    document.body.appendChild(root);
  }

  async function bootstrap() {
    injectStyles();

    try {
      const response = await fetch(
        \`\${baseUrl}/api/public/widget/\${encodeURIComponent(orgSlug)}\`,
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

      createWidget(payload.config);
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