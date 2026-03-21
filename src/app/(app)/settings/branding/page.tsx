// src/app/(app)/settings/branding/page.tsx
// Página de White-label: logo, favicon e cores da organização

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Palette,
  Image,
  Globe,
  CheckCircle,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Save,
  Eye,
} from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface OrgBranding {
  id:             string;
  name:           string;
  slug:           string;
  logo:           string | null;
  favicon:        string | null;
  primaryColor:   string;
  secondaryColor: string;
}

const DEFAULTS = {
  primaryColor:   '#6366f1',
  secondaryColor: '#4f46e5',
};

// ── Componente de preview de cor ──────────────────────────────────────────────
function ColorSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-lg border border-white/20 shadow-inner flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm font-mono text-gray-200">{color.toUpperCase()}</p>
      </div>
    </div>
  );
}

// ── Componente de input de cor ────────────────────────────────────────────────
function ColorInput({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  description: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const handleTextChange = (v: string) => {
    setText(v);
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setText(e.target.value); }}
            className="w-12 h-10 rounded-lg cursor-pointer border border-gray-600 bg-transparent p-0.5"
          />
        </div>
        <input
          type="text"
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          maxLength={7}
          placeholder="#6366f1"
          className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
        />
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function BrandingPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? '';
  const canEdit = role === 'owner' || role === 'admin';

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [message, setMessage]   = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name,           setName]           = useState('');
  const [logo,           setLogo]           = useState('');
  const [favicon,        setFavicon]        = useState('');
  const [primaryColor,   setPrimaryColor]   = useState(DEFAULTS.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULTS.secondaryColor);

  const [original, setOriginal] = useState<OrgBranding | null>(null);

  // ── Carregar dados ──────────────────────────────────────────────────────────
  const loadBranding = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/organizations');
      if (!res.ok) throw new Error('Erro ao carregar branding');
      const data: OrgBranding = await res.json();

      setOriginal(data);
      setName(data.name);
      setLogo(data.logo ?? '');
      setFavicon(data.favicon ?? '');
      setPrimaryColor(data.primaryColor);
      setSecondaryColor(data.secondaryColor);
    } catch {
      setMessage({ type: 'error', text: 'Erro ao carregar configurações.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadBranding(); }, [loadBranding]);

  // ── Aplicar preview de cor em tempo real ───────────────────────────────────
  useEffect(() => {
    document.documentElement.style.setProperty('--color-primary', primaryColor);
    document.documentElement.style.setProperty('--color-secondary', secondaryColor);
  }, [primaryColor, secondaryColor]);

  // ── Salvar ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const body: Record<string, any> = { name, primaryColor, secondaryColor };
      if (logo)     body.logo    = logo;
      if (favicon)  body.favicon = favicon;
      if (!logo)    body.logo    = null;
      if (!favicon) body.favicon = null;

      const res = await fetch('/api/organizations', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar');
      }

      const updated: OrgBranding = await res.json();
      setOriginal(updated);
      setMessage({ type: 'success', text: 'Branding salvo com sucesso!' });

      // Atualizar favicon dinamicamente
      if (updated.favicon) {
        const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (link) link.href = updated.favicon;
      }

      // Recarrega para aplicar cores no Sidebar e layout
      setTimeout(() => window.location.reload(), 1200);

    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Resetar para padrão ─────────────────────────────────────────────────────
  const handleReset = () => {
    setPrimaryColor(DEFAULTS.primaryColor);
    setSecondaryColor(DEFAULTS.secondaryColor);
  };

  // ── Detectar mudanças ───────────────────────────────────────────────────────
  const hasChanges =
    original &&
    (name           !== original.name           ||
     logo           !== (original.logo ?? '')   ||
     favicon        !== (original.favicon ?? '') ||
     primaryColor   !== original.primaryColor   ||
     secondaryColor !== original.secondaryColor);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-900 rounded-xl border border-white/10 p-6 animate-pulse">
            <div className="h-5 bg-gray-700 rounded w-40 mb-4" />
            <div className="h-10 bg-gray-800 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-100">Aparência</h1>
        <p className="text-gray-400 mt-1">
          Personalize o visual do CRM com a identidade da sua empresa
        </p>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
            : 'bg-red-500/10 text-red-400 border border-red-500/20'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Aviso de permissão */}
      {!canEdit && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-300">
            Apenas proprietários e administradores podem editar o branding.
          </p>
        </div>
      )}

      {/* ── Seção: Identidade ── */}
      <div className="bg-gray-900 rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-gray-100">Identidade</h2>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nome da organização
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit}
            placeholder="Minha Empresa"
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            URL do logotipo
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Recomendado: PNG ou SVG com fundo transparente, mínimo 200×50px
          </p>
          <input
            type="url"
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            disabled={!canEdit}
            placeholder="https://suaempresa.com/logo.png"
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {logo && (
            <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-white/10 flex items-center gap-3">
              <Eye className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <img
                src={logo}
                alt="Preview do logotipo"
                className="h-8 object-contain max-w-[180px]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            URL do favicon
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Recomendado: ICO ou PNG 32×32px
          </p>
          <input
            type="url"
            value={favicon}
            onChange={(e) => setFavicon(e.target.value)}
            disabled={!canEdit}
            placeholder="https://suaempresa.com/favicon.ico"
            className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {favicon && (
            <div className="mt-3 p-3 bg-gray-800 rounded-lg border border-white/10 flex items-center gap-3">
              <Eye className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <img
                src={favicon}
                alt="Preview do favicon"
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="text-xs text-gray-500">Aparece na aba do navegador</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Seção: Cores ── */}
      <div className="bg-gray-900 rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <Palette className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-gray-100">Cores</h2>
          </div>
          {canEdit && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar padrão
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <ColorInput
            label="Cor primária"
            value={primaryColor}
            onChange={setPrimaryColor}
            description="Botões, links e destaques principais"
          />
          <ColorInput
            label="Cor secundária"
            value={secondaryColor}
            onChange={setSecondaryColor}
            description="Hover, gradientes e elementos secundários"
          />
        </div>

        <div className="p-4 bg-gray-800/50 rounded-lg border border-white/5">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            Preview
          </p>
          <div className="flex flex-wrap gap-4 mb-4">
            <ColorSwatch color={primaryColor}   label="Primária" />
            <ColorSwatch color={secondaryColor} label="Secundária" />
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
              style={{ backgroundColor: primaryColor }}
            >
              Botão primário
            </button>
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition"
              style={{ backgroundColor: secondaryColor }}
            >
              Botão secundário
            </button>
            <span
              className="text-sm font-medium"
              style={{ color: primaryColor }}
            >
              Link de exemplo
            </span>
          </div>
        </div>
      </div>

      {/* ── Seção: CSS Variables ── */}
      <div className="bg-gray-900 rounded-xl border border-white/10 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Image className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-gray-100">CSS Variables</h2>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          As cores são aplicadas via variáveis CSS globais. Use nos seus componentes customizados:
        </p>
        <pre className="bg-gray-800 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`/* Disponíveis no :root após salvar */
--color-primary:   ${primaryColor};
--color-secondary: ${secondaryColor};

/* Uso no CSS */
background-color: var(--color-primary);
color: var(--color-secondary);`}
        </pre>
      </div>

      {/* ── Ações ── */}
      {canEdit && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500">
            {hasChanges ? '● Alterações não salvas' : '✓ Tudo salvo'}
          </p>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
            ) : (
              <><Save className="w-4 h-4" />Salvar branding</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}