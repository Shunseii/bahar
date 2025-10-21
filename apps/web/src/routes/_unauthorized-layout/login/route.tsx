import { authClient } from '@/lib/auth-client'
import { redirect } from '@tanstack/react-router'
import { createFileRoute } from '@tanstack/react-router'

type LoginSearch = {
  redirect?: string
}

export const Route = createFileRoute('/_unauthorized-layout/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    return {
      redirect: (search?.redirect as string) ?? undefined,
    }
  },

  beforeLoad: async () => {
    const { data } = await authClient.getSession()

    const isAuthenticated = !!data?.user

    // TODO: redirect based on the uri
    if (isAuthenticated) {
      throw redirect({
        to: '/',
      })
    }
  },
})
