'use client';

import { signIn } from 'next-auth/react';
import { useMemo, useState, Suspense, type FormEvent, type CSSProperties } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

function getErrorMessage(error: string | null) {
  switch (error) {
    case 'CredentialsSignin':
      return 'Email ou senha inválidos.';
    case 'AccessDenied':
      return 'Acesso negado.';
    case 'Configuration':
      return 'Erro de configuração no login.';
    default:
      return null;
  }
}

function LoginForm() {
  const searchParams = useSearchParams();
  const registered = searchParams.get('registered') === 'true';
  const loginError = searchParams.get('error');

  const searchErrorMessage = useMemo(() => getErrorMessage(loginError), [loginError]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setLoading(true);
    setLocalError(null);

    try {
      await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        callbackUrl: '/dashboard',
      });
    } catch (err) {
      console.error('[LOGIN] Erro no signIn:', err);
      setLocalError('Erro ao tentar entrar. Tente novamente.');
      setLoading(false);
    }
  }

  const errorMessage = localError || searchErrorMessage;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img
            src="/images/logo-mds.svg"
            alt="MDS Logo"
            className="h-32 w-auto"
          />
        </div>

        {registered && (
          <div className="mb-4 flex items-start gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Conta criada com sucesso! 🎉</p>
              <p className="text-xs text-green-700 mt-0.5">
                Faça seu login agora com os dados cadastrados.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-xl font-bold mb-4" style={{ color: '#2f3453' }}>
            Entrar
          </h1>

          <label className="block text-sm mb-1 text-gray-700">Email</label>
          <input
            className="w-full border rounded px-3 py-2 mb-3 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#2f3453' } as CSSProperties}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
          />

          <label className="block text-sm mb-1 text-gray-700">Senha</label>
          <div className="relative mb-2">
            <input
              className="w-full border rounded px-3 py-2 pr-10 focus:outline-none focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div className="flex justify-end mb-3">
            <Link
              href="/auth/forgot-password"
              className="text-sm hover:underline"
              style={{ color: '#2f3453' }}
            >
              Esqueceu sua senha?
            </Link>
          </div>

          {errorMessage && <p className="text-sm text-red-600 mb-3">{errorMessage}</p>}

          <button
            disabled={loading}
            className="w-full text-white rounded px-3 py-2 font-medium transition-opacity disabled:opacity-60"
            style={{ backgroundColor: '#2f3453' }}
            type="submit"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm mt-4 text-gray-600">
          Não tem uma conta?{' '}
          <Link
            href="/auth/signup"
            className="font-medium hover:underline"
            style={{ color: '#2f3453' }}
          >
            Cadastre-se grátis
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: '#2f3453' }}
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}