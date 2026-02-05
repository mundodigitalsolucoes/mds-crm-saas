'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react'; // 👈 Importe os ícones de olho

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false); // 👈 Novo estado para controlar a visibilidade da senha

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/dashboard',
    });

    setLoading(false);

    if (res?.error) {
      setError('Email ou senha inválidos.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-lg shadow">
        <h1 className="text-xl font-bold mb-4">Entrar</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          className="w-full border rounded px-3 py-2 mb-3"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label className="block text-sm mb-1">Senha</label>
        <div className="relative mb-3"> {/* 👈 Adicione um div relativo para posicionar o ícone */}
          <input
            className="w-full border rounded px-3 py-2 pr-10" // 👈 Adicione padding-right para o ícone
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? 'text' : 'password'} // 👈 Altera o tipo do input
            required
          />
          <button
            type="button" // 👈 Importante: o type 'button' evita que o clique dispare o submit do formulário
            onClick={() => setShowPassword(!showPassword)} // 👈 Alterna o estado showPassword
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />} {/* 👈 Ícone dinâmico */}
          </button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <button
          disabled={loading}
          className="w-full bg-indigo-600 text-white rounded px-3 py-2 disabled:opacity-60"
          type="submit"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="text-center text-sm mt-4">
          Não tem uma conta?{' '}
          <Link href="/auth/signup" className="text-indigo-600 hover:underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </div>
  );
}
