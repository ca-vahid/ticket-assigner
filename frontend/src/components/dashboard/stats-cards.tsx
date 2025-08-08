'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Ticket, TrendingUp, Clock } from 'lucide-react'
import { useAssignmentStats } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'

export function StatsCards() {
  const { stats, loading: statsLoading } = useAssignmentStats()
  const { agents, loading: agentsLoading } = useAgents()
  
  const availableAgents = agents.filter(a => a.isAvailable).length
  const totalAgents = agents.length

  const statsData = [
    {
      title: 'Total Assignments',
      value: statsLoading ? '...' : stats.totalAssignments.toString(),
      change: stats.autoAssigned > 0 ? `${stats.autoAssigned} auto` : 'No data',
      icon: Ticket,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Available Agents',
      value: agentsLoading ? '...' : `${availableAgents}/${totalAgents}`,
      change: `${totalAgents} total agents`,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Avg Score',
      value: statsLoading ? '...' : `${stats.avgScore}%`,
      change: 'Assignment quality',
      icon: Clock,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Success Rate',
      value: statsLoading ? '...' : `${stats.successRate}%`,
      change: 'Auto-assignment rate',
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statsData.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`${stat.bgColor} rounded-full p-2`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">
              <span className={stat.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}>
                {stat.change}
              </span>{' '}
              from last week
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}