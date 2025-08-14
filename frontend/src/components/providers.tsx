'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // Reduced from 60s to 30s for faster updates
            refetchOnWindowFocus: true, // Enable refetch when window regains focus
            refetchOnMount: true, // Ensure data is fresh when component mounts
            refetchOnReconnect: true, // Refetch when internet reconnects
            retry: 1, // Retry failed requests once
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}