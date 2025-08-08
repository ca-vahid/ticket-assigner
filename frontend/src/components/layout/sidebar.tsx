'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Ticket,
  Settings,
  BarChart3,
  History,
  Brain,
  Filter,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Assignments', href: '/assignments', icon: Ticket },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Scoring', href: '/scoring', icon: Brain },
  { name: 'Eligibility', href: '/eligibility', icon: Filter },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'History', href: '/history', icon: History },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-gray-900">
      <div className="flex h-16 items-center px-6">
        <h1 className="text-xl font-bold text-white">Ticket Assigner</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                'group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors'
              )}
            >
              <item.icon
                className={cn(
                  isActive ? 'text-white' : 'text-gray-400 group-hover:text-white',
                  'mr-3 h-5 w-5 flex-shrink-0'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-gray-800 p-4">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-700" />
          <div className="ml-3">
            <p className="text-sm font-medium text-white">Admin User</p>
            <p className="text-xs text-gray-400">admin@bgc.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}