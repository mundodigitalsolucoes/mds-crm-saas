'use client';

import { useEffect, useState } from 'react';

type Branding = {
  name: string;
  logo: string | null;
  favicon: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export default function OrganizationBrandingEditor({ organizationId }: { organizationId: string }) {
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
    setValue(current => current && ({ ...current, [key]: text }));
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
      setValue(updated);
      setStatus('Identidade visual salva.');
    } catch (e) { setStatus(e instanceof Error ? e.message : 'Falha ao salvar'); }
    finally { setSaving(false); }
  };
  if (!value) return <p className="text-xs text-gray-400">{status || 'Carregando identidade visual...'}</p>;
  return (
    <section className="space-y-3 rounded-lg border border-blue-900/30 p-3">
      <h4 className="text-sm font-semibold text-white">Identidade visual — controle MDS</h4>
      {([
        ['logo', 'URL do logo'], ['favicon', 'URL do favicon'],
        ['primaryColor', 'Cor primária'], ['secondaryColor', 'Cor secundária'],
      ] as const).map(([key, label]) => (
        <label key={key} className="block text-xs text-gray-300">
          {label}
          <input
            type="text" value={value[key] || ''}
            onChange={e => change(key, e.target.value)}
            placeholder={key.endsWith('Color') ? '#F58220' : 'https://...'}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-900 p-2 text-white"
          />
        </label>
      ))}
      <button type="button" disabled={saving} onClick={save}
        className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar identidade visual'}
      </button>
      <p role="status" className="text-xs text-gray-300">{status}</p>
    </section>
  );
}
