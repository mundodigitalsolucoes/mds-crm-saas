import { withAuth } from "next-auth/middleware"

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token
  },
  pages: {
    signIn: "/auth/login",
  },
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/kanban/:path*",
    "/projetos/:path*",
    "/os/:path*",
    "/tarefas/:path*",
    "/agenda/:path*",
    "/relatorios/:path*",
    "/configuracoes/:path*",
  ]
}
