'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAgents } from '@/hooks/useAgents'
import { Users } from 'lucide-react'

export function AgentWorkload() {
  const { agents, loading } = useAgents()
  
  // Filter for available agents and sort by workload
  const activeAgents = agents
    .filter(a => a.isAvailable)
    .sort((a, b) => b.currentTicketCount - a.currentTicketCount)
    .slice(0, 8) // Show top 8 agents
  
  const maxTickets = 10 // Default max concurrent tickets
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-8 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (activeAgents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Workload</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Users className="h-8 w-8 mr-2" />
            <span>No available agents</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Workload</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activeAgents.map((agent) => {
            const percentage = (agent.currentTicketCount / maxTickets) * 100
            return (
              <div key={agent.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{agent.firstName} {agent.lastName}</span>
                  <span className="text-muted-foreground">
                    {agent.currentTicketCount}/{maxTickets} tickets
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className={cn(
                    "h-2",
                    percentage >= 90 && "bg-red-100",
                    percentage >= 70 && percentage < 90 && "bg-yellow-100",
                    percentage < 70 && "bg-green-100"
                  )}
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}