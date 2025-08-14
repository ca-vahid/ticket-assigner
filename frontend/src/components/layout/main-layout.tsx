'use client'

import { ReactNode } from 'react'
import { SidebarV2 } from './sidebar-v2'

interface MainLayoutProps {
  children: ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarV2 />
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}