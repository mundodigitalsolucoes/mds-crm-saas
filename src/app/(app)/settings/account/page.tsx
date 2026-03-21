// src/app/(app)/settings/account/page.tsx
'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { signOut } from 'next-auth/react'
import { User, Download, Trash2, Shield, AlertTriangle, CheckCircle, Loader2, Crown } from 'lucide-react'

export default function AccountSettingsPage() {
  const { data: session } = useSession()
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const userName = session?.user?.name || 'Usuário'
  const userEmail = session?.user?.email || ''
  const userRole = (session?.user as any)?.role || ''
  const isOwner = userRole === 'owner'

  const handleExportData = async () => {
    setExportLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/export-data')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao exportar dados')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meus-dados-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setMessage({ type: 'success', text: 'Dados exportados com sucesso!' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setExportLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') return
    setDeleteLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir conta')
      }
      signOut({ callbackUrl: '/auth/login?deleted=true' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
      setDeleteLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Minha Conta</h1>
        <p className="text-gray-600 mt-1">Gerencie seus dados pessoais e direitos de privacidade</p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success'
            ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
            : <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          }
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Perfil */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">{userName}</h2>
              {isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                  <Crown className="w-3 h-3" /> Proprietário
                </span>
              )}
            </div>
            <p className="text-gray-500 text-sm">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* LGPD */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-gray-900">Seus Direitos (LGPD)</h2>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem
          direito à portabilidade e eliminação dos seus dados pessoais.
        </p>

        {/* Exportar */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg mb-4">
          <Download className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 text-sm">Exportar meus dados</h3>
            <p className="text-xs text-gray-500 mt-1 mb-3">
              Baixe uma cópia de todos os seus dados pessoais em formato JSON.
            </p>
            <button
              onClick={handleExportData}
              disabled={exportLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
            >
              {exportLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Exportando...</> : <><Download className="w-4 h-4" />Exportar dados</>}
            </button>
          </div>
        </div>

        {/* Excluir — apenas não-owners */}
        {isOwner ? (
          <div className="flex items-start gap-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <Crown className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-amber-900 text-sm">Exclusão de conta indisponível</h3>
              <p className="text-xs text-amber-700 mt-1">
                Proprietários não podem excluir a própria conta diretamente.
                Para encerrar a organização, entre em contato com o suporte.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 p-4 bg-red-50 rounded-lg border border-red-100">
            <Trash2 className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-red-900 text-sm">Excluir minha conta</h3>
              <p className="text-xs text-red-700 mt-1 mb-3">
                Todos os seus dados pessoais serão anonimizados de forma irreversível.
                Os dados da organização serão mantidos desvinculados da sua identidade.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                  Solicitar exclusão
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <p className="text-xs text-red-800 font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Esta ação é irreversível! Digite EXCLUIR para confirmar.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder='Digite "EXCLUIR"'
                    className="w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmText !== 'EXCLUIR' || deleteLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                    >
                      {deleteLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Excluindo...</> : 'Confirmar exclusão'}
                    </button>
                    <button
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText('') }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-500 space-x-4">
        <a href="/privacy" target="_blank" className="hover:underline text-indigo-600">Política de Privacidade</a>
        <span>·</span>
        <a href="/terms" target="_blank" className="hover:underline text-indigo-600">Termos de Uso</a>
      </div>
    </div>
  )
}