'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertCircle, PlayCircle, PauseCircle, Clock } from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { formatDistanceToNow } from 'date-fns'

export function AutoAssignmentQueue() {
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(true)
  const { assignmentHistory } = useAssignments({ limit: 50 })
  
  // Filter for recent auto-assigned tickets
  const autoAssigned = (assignmentHistory.data || []).filter(
    a => a.type === 'AUTO_ASSIGNED'
  )
  
  // Get tickets that are queued (in this case, we'll show recent auto-assigned)
  const queuedTickets = autoAssigned.slice(0, 5)
  
  // Calculate stats
  const totalAssignments = assignmentHistory.data?.length || 0
  const autoAssignedCount = autoAssigned.length
  const avgScore = autoAssigned.length > 0
    ? (autoAssigned.reduce((acc, a) => acc + (a.score || 0), 0) / autoAssigned.length * 100).toFixed(0)
    : 0
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Auto-Assignment Settings</CardTitle>
            <div className="flex items-center space-x-2">
              <Switch id="auto-assign" />
              <Label htmlFor="auto-assign">Enable Auto-Assignment</Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">Confidence Threshold</p>
              <p className="text-2xl font-bold">70%</p>
              <p className="text-xs text-muted-foreground">
                Minimum score for auto-assignment
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Auto-Assigned</p>
              <p className="text-2xl font-bold">{autoAssignedCount}</p>
              <p className="text-xs text-muted-foreground">
                Total auto-assigned tickets
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Average Score</p>
              <p className="text-2xl font-bold">{avgScore ? `${avgScore}%` : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">
                Average confidence score
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently Auto-Assigned</CardTitle>
        </CardHeader>
        <CardContent>
          {queuedTickets.length > 0 ? (
            <div className="space-y-4">
              {queuedTickets.map((ticket, idx) => (
                <div key={ticket.id} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">#{ticket.ticketId}</p>
                      {idx === 0 && (
                        <Badge variant="default">
                          Latest
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{ticket.ticketSubject}</p>
                    <p className="text-xs text-muted-foreground">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">Confidence</p>
                      <p className="text-lg font-bold">{(ticket.score * 100).toFixed(0)}%</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Auto-assigned
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-sm">No auto-assignments yet</p>
              <p className="text-xs mt-2">Auto-assigned tickets will appear here</p>
            </div>
          )}
        </CardContent>
