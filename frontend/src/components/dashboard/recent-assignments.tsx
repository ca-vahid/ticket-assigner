'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Clock } from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow } from 'date-fns'

const statusConfig = {
  AUTO_ASSIGNED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Auto',
  },
  SUGGESTED: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Suggested',
  },
  MANUAL_OVERRIDE: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Manual',
  },
}

export function RecentAssignments() {
  const { assignmentHistory } = useAssignments({ limit: 5 })
  const { agents } = useAgents()
  
  const assignments = assignmentHistory.data || []
  const loading = assignmentHistory.isLoading

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Assignments</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No assignments yet</p>
            <p className="text-xs mt-2">Test the webhook to see assignments here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const agent = agents.find(a => a.id === assignment.agentId)
              const status = statusConfig[assignment.type as keyof typeof statusConfig] || statusConfig.SUGGESTED
              const StatusIcon = status.icon
              
              return (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between space-x-4 rounded-lg border p-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">#{assignment.ticketId}</p>
                      <Badge variant="outline" className="text-xs">
                        Score: {(assignment.score * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {assignment.ticketSubject || 'Untitled Ticket'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned to {agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown'} • {' '}
                      {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`${status.bgColor} rounded-full p-1.5`}>
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                    </div>
                    {assignment.type === 'SUGGESTED' && (
                      <Button size="sm" variant="outline">
                        Review
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}