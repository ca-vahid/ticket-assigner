'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssignmentDialog } from './assignment-dialog'
import { CheckCircle, XCircle, User, AlertCircle, Clock } from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow } from 'date-fns'

export function PendingAssignments() {
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  const { assignmentHistory } = useAssignments()
  const { agents } = useAgents()
  
  // Filter for SUGGESTED assignments (pending review)
  const pendingAssignments = (assignmentHistory.data || []).filter(
    a => a.type === 'SUGGESTED'
  )
  
  const loading = assignmentHistory.isLoading

  const handleReview = (assignment: any) => {
    setSelectedAssignment(assignment)
    setDialogOpen(true)
  }

  const handleAssign = (ticketId: string, agentId: string) => {
    // TODO: Implement actual assignment
    console.log(`Assigning ticket ${ticketId} to agent ${agentId}`)
    setDialogOpen(false)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-gray-100 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pendingAssignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm">No assignments pending review</p>
            <p className="text-xs mt-2">All tickets have been auto-assigned</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            Pending Review
            {pendingAssignments.length > 0 && (
              <Badge className="ml-2" variant="secondary">
                {pendingAssignments.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingAssignments.map((assignment) => {
              const agent = agents.find(a => a.id === assignment.agentId)
              const alternatives = assignment.alternatives || []
              
              return (
                <div
                  key={assignment.id}
                  className="rounded-lg border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">#{assignment.ticketId}</Badge>
                        <Badge variant="secondary">Pending</Badge>
                      </div>
                      <h4 className="font-medium">{assignment.ticketSubject || 'Untitled Ticket'}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-muted-foreground">Top Suggestions:</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            Score: {(assignment.score * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        {agent && (
                          <span className="text-xs text-muted-foreground">
                            {agent.currentTicketCount} active tickets
                          </span>
                        )}
                      </div>
                      
                      {alternatives.slice(0, 2).map((alt: any, idx: number) => {
                        const altAgent = agents.find(a => a.id === alt.agentId)
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded border">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {altAgent ? `${altAgent.firstName} ${altAgent.lastName}` : alt.agentName || 'Unknown'}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Score: {((alt.totalScore || alt.score || 0) * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => handleReview(assignment)}
                      className="flex-1"
                    >
                      Review & Assign
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleAssign(assignment.ticketId, assignment.agentId)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {selectedAssignment && (
        <AssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          assignment={selectedAssignment}
          onAssign={handleAssign}
        />
      )}
    </>
  )
}