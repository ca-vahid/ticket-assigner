'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, FileText, Clock } from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow } from 'date-fns'

const statusIcons = {
  AUTO_ASSIGNED: CheckCircle,
  SUGGESTED: Clock,
  MANUAL_OVERRIDE: AlertCircle,
}

const statusColors = {
  AUTO_ASSIGNED: 'text-green-600',
  SUGGESTED: 'text-yellow-600',
  MANUAL_OVERRIDE: 'text-orange-600',
}

export function AssignmentHistory() {
  const { assignmentHistory } = useAssignments({ limit: 20 })
  const { agents } = useAgents()
  
  const assignments = assignmentHistory.data || []
  const loading = assignmentHistory.isLoading

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No assignment history yet</p>
            <p className="text-xs mt-2">Create test tickets to see the history</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {assignments.map((item) => {
            const agent = agents.find(a => a.id === item.agentId)
            const StatusIcon = statusIcons[item.type] || Clock
            const statusColor = statusColors[item.type] || 'text-gray-600'
            
            return (
              <div
                key={item.id}
                className="rounded-lg border p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">#{item.ticketId}</Badge>
                      <StatusIcon className={`h-4 w-4 ${statusColor}`} />
                      <span className="text-xs text-muted-foreground">
                        {item.type.replace('_', ' ').toLowerCase()}
                      </span>
                    </div>
                    <h4 className="font-medium text-sm mb-1">
                      {item.ticketSubject || 'Untitled Ticket'}
                    </h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Assigned to: <span className="font-medium text-foreground">
                          {agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown'}
                        </span>
                      </span>
                      <span>Score: {(item.score * 100).toFixed(0)}%</span>
                      <span>
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {item.scoreBreakdown && (
                      <div className="mt-2 flex gap-2">
                        {Object.entries(item.scoreBreakdown).slice(0, 3).map(([key, value]) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {key.replace(/([A-Z])/g, ' $1').trim()}: {((value as number) * 100).toFixed(0)}%
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}