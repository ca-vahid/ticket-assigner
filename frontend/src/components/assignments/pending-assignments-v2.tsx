'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AssignmentDialogV2 } from './assignment-dialog-v2'
import { 
  CheckCircle, 
  XCircle, 
  User, 
  AlertCircle, 
  Clock, 
  Ticket,
  TrendingUp,
  Users,
  Zap,
  ChevronRight,
  Hash,
  Calendar
} from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

export function PendingAssignmentsV2() {
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  
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

  const handleQuickAssign = (e: React.MouseEvent, ticketId: string, agentId: string, agentName: string) => {
    e.stopPropagation()
    if (confirm(`Assign ticket #${ticketId} to ${agentName}?`)) {
      console.log(`Assigning ticket ${ticketId} to agent ${agentId}`)
      // TODO: Implement actual assignment
    }
  }

  const toggleExpand = (assignmentId: string) => {
    setExpandedCard(expandedCard === assignmentId ? null : assignmentId)
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-48 animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (pendingAssignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-sm font-medium">No assignments pending review</p>
            <p className="text-xs mt-2 text-muted-foreground">All tickets have been auto-assigned</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Header Stats */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Pending Review</h3>
          <Badge variant="secondary" className="text-sm">
            {pendingAssignments.length} tickets
          </Badge>
        </div>
        <Button variant="outline" size="sm">
          Auto-Approve All
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {pendingAssignments.map((assignment) => {
          const primaryAgent = agents.find(a => a.id === assignment.agentId)
          const alternatives = assignment.alternatives || []
          const isExpanded = expandedCard === assignment.id
          const topAlternative = alternatives[0]
          
          return (
            <Card 
              key={assignment.id}
              className={cn(
                "relative transition-all duration-200 hover:shadow-lg cursor-pointer",
                isExpanded && "md:col-span-2 lg:col-span-2"
              )}
              onClick={() => toggleExpand(assignment.id)}
            >
              {/* Urgency Indicator */}
              <div className="absolute top-0 right-0 w-2 h-12 bg-gradient-to-b from-orange-400 to-orange-200 rounded-tr-lg rounded-bl-lg" />
              
              <CardContent className="p-4">
                {/* Ticket Info - Compact Header */}
                <div className="mb-3">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground">
                        {assignment.ticketId}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: false })}
                    </Badge>
                  </div>
                  <h4 className="font-medium text-sm line-clamp-2 min-h-[2.5rem]">
                    {assignment.ticketSubject || 'Untitled Ticket'}
                  </h4>
                </div>

                {/* Primary Agent - Hero Card */}
                {primaryAgent && (
                  <div className="mb-3">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {primaryAgent.firstName[0]}{primaryAgent.lastName[0]}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {`${primaryAgent.firstName} ${primaryAgent.lastName}`}
                            </p>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">
                                {(assignment.score * 100).toFixed(0)}% match
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2 bg-blue-600 hover:bg-blue-700"
                          onClick={(e) => handleQuickAssign(
                            e,
                            assignment.ticketId, 
                            assignment.agentId,
                            `${primaryAgent.firstName} ${primaryAgent.lastName}`
                          )}
                        >
                          <Zap className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Agent Stats Mini */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Ticket className="h-3 w-3 text-muted-foreground" />
                          <span>{primaryAgent.currentTicketCount || 0} tickets</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs px-1 py-0">
                            {primaryAgent.level}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Alternatives - Collapsed View */}
                {!isExpanded && alternatives.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">
                      +{alternatives.length} alternatives
                    </p>
                    {topAlternative && (
                      <div className="text-xs bg-gray-50 rounded p-2 flex items-center justify-between">
                        <span className="truncate">
                          {topAlternative.agentName || 'Alternative'}
                        </span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {((topAlternative.totalScore || topAlternative.score || 0) * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                )}

                {/* Expanded Alternatives */}
                {isExpanded && alternatives.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs text-muted-foreground font-medium">Alternative Agents:</p>
                    {alternatives.slice(0, 3).map((alt: any, idx: number) => {
                      const altAgent = agents.find(a => a.id === alt.agentId)
                      const agentName = altAgent 
                        ? `${altAgent.firstName} ${altAgent.lastName}` 
                        : alt.agentName || 'Unknown'
                      
                      return (
                        <div key={alt.agentId || idx} className="bg-gray-50 rounded p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center">
                                <User className="h-3 w-3 text-gray-600" />
                              </div>
                              <span className="text-xs font-medium">{agentName}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                {((alt.totalScore || alt.score || 0) * 100).toFixed(0)}%
                              </Badge>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={(e) => handleQuickAssign(
                                  e,
                                  assignment.ticketId,
                                  alt.agentId,
                                  agentName
                                )}
                              >
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleReview(assignment)
                    }}
                    className="flex-1 h-8"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Review
                  </Button>
                  {primaryAgent && (
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={(e) => handleQuickAssign(
                        e,
                        assignment.ticketId,
                        assignment.agentId,
                        `${primaryAgent.firstName} ${primaryAgent.lastName}`
                      )}
                      className="flex-1 h-8 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedAssignment && (
        <AssignmentDialogV2
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          assignment={selectedAssignment}
          onAssign={(ticketId, agentId, reason) => {
            console.log(`Assigning ticket ${ticketId} to agent ${agentId}`, reason ? `Reason: ${reason}` : '')
            setDialogOpen(false)
          }}
        />
      )}
    </>
  )
}