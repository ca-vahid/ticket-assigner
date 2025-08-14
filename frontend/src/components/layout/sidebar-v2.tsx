'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useLocalStorage } from '@/hooks/useOptimizedData'
import {
  LayoutDashboard,
  Users,
  Ticket,
  Settings,
  BarChart3,
  History,
  Brain,
  Filter,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  Moon,
  Sun,
  Lock,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Zap,
  TrendingUp,
  Clock,
  Shield
} from 'lucide-react'

interface NavItem {
  name: string
  href: string | null
  icon: any
  badge?: string | number
  comingSoon?: boolean
  description?: string
}

const navigation: NavItem[] = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: LayoutDashboard,
    description: 'Overview and metrics'
  },
  { 
    name: 'Assignments', 
    href: '/assignments', 
    icon: Ticket,
    description: 'Manage ticket assignments'
  },
  { 
    name: 'Agents', 
    href: '/agents', 
    icon: Users,
    description: 'Agent management'
  },
  { 
    name: 'Skills', 
    href: '/skills', 
    icon: Sparkles,
    description: 'Skill detection & review'
  },
  { 
    name: 'Scoring', 
    href: '/scoring', 
    icon: Brain,
    description: 'Configure scoring algorithm'
  },
  { 
    name: 'Eligibility', 
    href: '/eligibility', 
    icon: Filter,
    description: 'Set eligibility rules'
  },
  { 
    name: 'Analytics', 
    href: null, 
    icon: BarChart3,
    comingSoon: true,
    description: 'Advanced analytics'
  },
  { 
    name: 'History', 
    href: null, 
    icon: History,
    comingSoon: true,
    description: 'Assignment history'
  },
  { 
    name: 'Admin Tools', 
    href: '/settings', 
    icon: Shield,
    description: 'System administration & data management'
  },
]

const bottomNavigation = [
  { 
    name: 'Help', 
    href: null, 
    icon: HelpCircle,
    comingSoon: true
  },
  { 
    name: 'Notifications', 
    href: null, 
    icon: Bell,
    badge: 3,
    comingSoon: true
  },
]

export function SidebarV2() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', false)
  const [isDarkMode, setIsDarkMode] = useLocalStorage('dark-mode', true)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) {
        setIsCollapsed(true)
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Dark mode is now only applied to the sidebar, not the entire app

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen)
    } else {
      setIsCollapsed(!isCollapsed)
    }
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href
    const isDisabled = item.comingSoon || !item.href

    const linkContent = (
      <div
        className={cn(
          "group flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/25"
            : isDisabled
            ? cn("cursor-not-allowed opacity-60", isDarkMode ? "text-gray-500" : "text-gray-400")
            : cn(
                isDarkMode 
                  ? "text-gray-300 hover:bg-gray-800/50" 
                  : "text-gray-700 hover:bg-gray-100"
              ),
          !isCollapsed && "mx-2"
        )}
      >
        <item.icon
          className={cn(
            "flex-shrink-0 transition-all",
            isActive 
              ? "text-white" 
              : isDisabled
              ? isDarkMode ? "text-gray-600" : "text-gray-400"
              : cn(
                  isDarkMode 
                    ? "text-gray-400 group-hover:text-gray-200" 
                    : "text-gray-500 group-hover:text-gray-700"
                ),
            isCollapsed ? "h-5 w-5" : "h-5 w-5 mr-3"
          )}
        />
        {!isCollapsed && (
          <>
            <span className="flex-1">{item.name}</span>
            {item.badge && !item.comingSoon && (
              <Badge 
                variant={item.badge === 'new' ? 'default' : 'secondary'} 
                className="ml-auto h-5 px-1.5 text-xs"
              >
                {item.badge}
              </Badge>
            )}
            {item.comingSoon && (
              <Badge 
                variant="outline" 
                className={cn(
                  "ml-auto h-5 px-1.5 text-xs",
                  isDarkMode 
                    ? "bg-gray-800 text-gray-400 border-gray-600" 
                    : "bg-gray-100 text-gray-500 border-gray-300"
                )}
              >
                <Lock className="h-3 w-3 mr-1" />
                Soon
              </Badge>
            )}
          </>
        )}
      </div>
    )

    if (isCollapsed) {
      return (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              {isDisabled ? (
                <div>{linkContent}</div>
              ) : (
                <Link href={item.href!}>{linkContent}</Link>
              )}
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              <span>{item.name}</span>
              {item.comingSoon && (
                <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    if (isDisabled) {
      return <div>{linkContent}</div>
    }

    return <Link href={item.href!}>{linkContent}</Link>
  }

  const sidebarContent = (
    <>
      {/* Logo/Header */}
      <div className={cn(
        "flex items-center border-b",
        isDarkMode ? "border-gray-800" : "border-gray-200",
        isCollapsed ? "h-16 justify-center px-3" : "h-16 px-6"
      )}>
        {isCollapsed ? (
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-lg shadow-lg">
            T
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold text-lg shadow-lg">
              T
            </div>
            <div>
              <h1 className={cn("text-lg font-bold", isDarkMode ? "text-white" : "text-gray-900")}>Ticket AI</h1>
              <p className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>Assignment System</p>
            </div>
          </div>
        )}
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {!isCollapsed && (
          <div className="px-4 mb-2">
            <p className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isDarkMode ? "text-gray-500" : "text-gray-400"
            )}>
              Main Menu
            </p>
          </div>
        )}
        
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavLink key={item.name} item={item} />
          ))}
        </div>

        {!isCollapsed && (
          <>
            <div className="px-4 mt-8 mb-2">
              <p className={cn(
              "text-xs font-semibold uppercase tracking-wider",
              isDarkMode ? "text-gray-500" : "text-gray-400"
            )}>
                Quick Actions
              </p>
            </div>
            <div className="space-y-1">
              {bottomNavigation.map((item) => (
                <NavLink key={item.name} item={item} />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className={cn("border-t", isDarkMode ? "border-gray-800" : "border-gray-200")}>
        {/* Theme Toggle */}
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center p-3" : "px-4 py-3"
        )}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "transition-all",
              isCollapsed ? "p-2" : "w-full justify-start"
            )}
          >
            {isDarkMode ? (
              <>
                <Moon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Dark Mode"}
              </>
            ) : (
              <>
                <Sun className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                {!isCollapsed && "Light Mode"}
              </>
            )}
          </Button>
        </div>

        {/* User Profile */}
        <div className={cn(
          "border-t",
          isDarkMode ? "border-gray-800" : "border-gray-200",
          isCollapsed ? "p-3" : "p-4"
        )}>
          {isCollapsed ? (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex justify-center">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-indigo-500/25">
                      A
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div>
                    <p className="font-medium">Admin User</p>
                    <p className="text-xs text-gray-500">admin@bgc.com</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm shadow-lg shadow-indigo-500/25">
                A
              </div>
              <div className="ml-3 flex-1">
                <p className={cn("text-sm font-medium", isDarkMode ? "text-white" : "text-gray-900")}>Admin User</p>
                <p className={cn("text-xs", isDarkMode ? "text-gray-400" : "text-gray-500")}>admin@bgc.com</p>
              </div>
              <Button variant="ghost" size="sm" className="p-1">
                <LogOut className="h-4 w-4 text-gray-500" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle (Desktop) */}
      {!isMobile && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "absolute -right-3 top-20 z-50 h-6 w-6 rounded-full border shadow-md p-0 hover:shadow-lg transition-all",
            isDarkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      )}
    </>
  )

  // Mobile menu overlay
  if (isMobile) {
    return (
      <>
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Mobile Sidebar */}
        {mobileMenuOpen && (
          <>
            <div 
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-72 flex-col transition-all duration-300 border-r shadow-xl",
              isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            )}>
              {sidebarContent}
            </div>
          </>
        )}
      </>
    )
  }

  // Desktop sidebar
  return (
    <div 
      className={cn(
        "relative flex h-full flex-col transition-all duration-300 ease-in-out",
        isDarkMode ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200",
        "border-r shadow-sm",
        isCollapsed ? "w-[70px]" : "w-64"
      )}
    >
      {sidebarContent}
    </div>
  )
}