'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import BrandLogo from '@/components/BrandLogo';
import { DEFAULT_BRANDING, brandingValues, brandingTokens } from '@/lib/branding-values';

type Branding = {
  name: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export default function OrganizationBrandingEditor({ organizationId }: { organizationId: string }) {
  return <BrandingEditor key={organizationId} organizationId={organizationId} />;
}

function BrandingEditor({ organizationId }: { organizationId: string }) {
  const [value, setValue] = useState<Branding | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/admin/organizations/${organizationId}`)
      .then(async r => { if (!r.ok) throw Error('Não foi possível carregar a identidade'); return r.json(); })
      .then(org => { if (active) setValue({
        name: org.name, logo: org.logo, favicon: org.favicon,
        primaryColor: org.primaryColor, secondaryColor: org.secondaryColor,
      }); })
      .catch(e => { if (active) setStatus(e.message); });
    return () => { active = false; };
  }, [organizationId]);
  const change = (key: keyof Branding, text: string) => {
    setValue(current => current && ({ ...current, [key]: (key === 'logo' || key === 'favicon') && !text.trim() ? null : text }));
  };
  const save = async () => {
    if (!value || saving) return;
    setSaving(true); setStatus('');
    try {
      const r = await fetch(`/api/admin/organizations/${organizationId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding: value }),
      });
      if (!r.ok) {
        const error = await r.json();
        throw Error(error.error || 'Não foi possível salvar');
      }
      const updated = await r.json();
      setValue({ name: updated.name, logo: updated.logo, favicon: updated.favicon, primaryColor: updated.primaryColor, secondaryColor: updated.secondaryColor });
      setStatus('Identidade visual salva.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Falha ao salvar'); }
    finally { setSaving(false); }
  };
  if (!value) return <p className="text-xs text-gray-400">{status || 'Carregando identidade visual...'}</p>;
  return (
    <section className="space-y-3 rounded-lg border border-blue-900/30 p-3">
      <h4 className="text-sm font-semibold text-white">Identidade visual — controle MDS</h4>
      {([
        ['name', 'Nome de exibição'], ['logo', 'URL do logotipo horizontal'], ['favicon', 'URL do favicon / ícone compacto'],
        ['primaryColor', 'Cor primária'], ['secondaryColor', 'Cor secundária'],
      ] as const).map(([key, label]) => (
        <label key={key} className="block text-xs text-gray-300">
          {label}
          <input
            type="text" value={value[key] || ''}
            onChange={e => change(key, e.target.value)}
            placeholder={key.endsWith('Color') ? '#336699' : key === 'name' ? 'Nome da organização' : 'https://... ou /images/...'}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-900 p-2 text-white"
          />
        </label>
      ))}
      <div aria-label="Pré-visualização da identidade" style={brandingTokens(brandingValues(value)) as CSSProperties}
        className="space-y-2 rounded p-3">
        <div style={{ background: 'var(--brand-sidebar)', color: 'var(--brand-sidebar-text)' }} className="rounded p-3">
          <BrandLogo key={value.logo} branding={value} />
          <span>{value.name}</span>
          <div style={{ background: 'var(--brand-active)', color: 'var(--brand-active-text)' }} className="mt-2 rounded p-2">Item ativo</div>
        </div>
        <p className="text-xs text-gray-300">O favicon também é o ícone do menu recolhido. A prévia não altera o plano.</p>
      </div>
      <button type="button" disabled={saving} onClick={() => { setValue({ ...DEFAULT_BRANDING }); setStatus('Padrão MDS na prévia. Salve para confirmar.'); }}
        className="mr-2 rounded border border-gray-500 px-3 py-2 text-sm text-white">Restaurar padrão MDS</button>
      <button type="button" disabled={saving} onClick={save}
        className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar identidade visual'}
      </button>
      <p role="status" className="text-xs text-gray-300">{status}</p>
    </section>
  );
}
