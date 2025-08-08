'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAgents } from '@/hooks/useAgents'
import { Users, Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AgentWorkload() {
  const { agents, loading } = useAgents()
  
  // Filter for available agents and sort by weighted workload
  const activeAgents = agents
    .filter(a => a.isAvailable)
    .sort((a, b) => (Number(b.weightedTicketCount) || b.currentTicketCount) - (Number(a.weightedTicketCount) || a.currentTicketCount))
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
        <TooltipProvider>
          <div className="space-y-4">
            {activeAgents.map((agent) => {
              const weightedCount = Number(agent.weightedTicketCount) || agent.currentTicketCount
              const percentage = (weightedCount / maxTickets) * 100
              const breakdown = agent.ticketWorkloadBreakdown
              
              return (
                <div key={agent.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{agent.firstName} {agent.lastName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {agent.currentTicketCount} tickets
                        {agent.weightedTicketCount && Number(agent.weightedTicketCount) !== agent.currentTicketCount && (
                          <span className="font-semibold text-orange-600 ml-1">
                            ({Number(agent.weightedTicketCount).toFixed(1)} weighted)
                          </span>
                        )}
                      </span>
                      {breakdown && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              <p className="font-semibold mb-2">Ticket Age Distribution:</p>
                              {breakdown.fresh > 0 && (
                                <p className="text-red-600">Fresh (0-1 days): {breakdown.fresh} tickets</p>
                              )}
                              {breakdown.recent > 0 && (
                                <p className="text-orange-600">Recent (2-5 days): {breakdown.recent} tickets</p>
                              )}
                              {breakdown.stale > 0 && (
                                <p className="text-yellow-600">Stale (6-14 days): {breakdown.stale} tickets</p>
                              )}
                              {breakdown.abandoned > 0 && (
                                <p className="text-gray-600">Abandoned (15+ days): {breakdown.abandoned} tickets</p>
                              )}
                              <div className="pt-2 mt-2 border-t">
                                <p className="text-muted-foreground">
                                  Weighted score prevents agents from hoarding old tickets.
                                  Fresh tickets count more towards workload.
                                </p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
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
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}