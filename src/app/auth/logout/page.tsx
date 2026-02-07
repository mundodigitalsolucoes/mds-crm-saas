"use client"

import { signOut } from "next-auth/react"
import { useEffect } from "react"

export default function LogoutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/auth/login" })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Saindo...</p>
    </div>
  )
}
