'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { User, Briefcase, TrendingUp, MapPin } from 'lucide-react'
import { useAgents } from '@/hooks/useAgents'

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: any
  onAssign: (ticketId: string, agentId: string, reason?: string) => void
}

export function AssignmentDialog({
  open,
  onOpenChange,
  assignment,
  onAssign,
}: AssignmentDialogProps) {
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [overrideReason, setOverrideReason] = useState('')
  const { agents } = useAgents()
  const [suggestions, setSuggestions] = useState<any[]>([])

  useEffect(() => {
    if (!assignment || !agents.length) return
    
    // Build suggestions list with full agent data
    const suggestionsList = []
    
    // Add primary assigned agent first
    if (assignment.agentId) {
      const primaryAgent = agents.find(a => a.id === assignment.agentId)
      if (primaryAgent) {
        suggestionsList.push({
          id: primaryAgent.id,
          name: `${primaryAgent.firstName} ${primaryAgent.lastName}`,
          score: assignment.score || 0,
          skills: primaryAgent.skills || [],
          currentTicketCount: primaryAgent.currentTicketCount || 0,
          isPrimary: true
        })
      }
    }
    
    // Add alternatives
    if (assignment.alternatives) {
      assignment.alternatives.forEach((alt: any) => {
        const agent = agents.find(a => a.id === alt.agentId)
        if (agent) {
          suggestionsList.push({
            id: agent.id,
            name: alt.agentName || `${agent.firstName} ${agent.lastName}`,
            score: alt.totalScore || alt.score || 0,
            skills: agent.skills || [],
            currentTicketCount: agent.currentTicketCount || 0,
            isPrimary: false
          })
        } else {
          // Fallback if agent not found in list
          suggestionsList.push({
            id: alt.agentId,
            name: alt.agentName || 'Unknown Agent',
            score: alt.totalScore || alt.score || 0,
            skills: [],
            currentTicketCount: 0,
            isPrimary: false
          })
        }
      })
    }
    
    setSuggestions(suggestionsList)
    // Pre-select the primary agent
    if (suggestionsList.length > 0 && !selectedAgent) {
      setSelectedAgent(suggestionsList[0].id)
    }
  }, [assignment, agents])

  if (!assignment) return null

  const handleAssign = () => {
    if (selectedAgent) {
      onAssign(assignment.ticketId, selectedAgent, overrideReason)
      setSelectedAgent('')
      setOverrideReason('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review Assignment for #{assignment.ticketId}</DialogTitle>
          <DialogDescription>
            {assignment.ticketSubject || assignment.subject || 'Untitled Ticket'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Suggested Agents</h3>
            <RadioGroup value={selectedAgent} onValueChange={setSelectedAgent}>
              {suggestions.length > 0 ? suggestions.map((agent: any, index: number) => (
                <div
                  key={agent.id}
                  className="flex items-start space-x-3 rounded-lg border p-4"
                >
                  <RadioGroupItem value={agent.id} id={agent.id} />
                  <Label htmlFor={agent.id} className="flex-1 cursor-pointer">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          {agent.isPrimary && (
                            <Badge variant="default" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline">
                          Score: {((agent.score || 0) * 100).toFixed(0)}%
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          <span>Skills: {agent.skills?.length > 0 ? agent.skills.join(', ') : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          <span>Current Load: {agent.currentTicketCount || 0}/10</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>Workload</span>
                          <span>{((agent.currentTicketCount || 0) * 10)}%</span>
                        </div>
                        <Progress value={(agent.currentTicketCount || 0) * 10} className="h-2" />
                      </div>
                    </div>
                  </Label>
                </div>
              )) : (
                <div className="text-center py-4 text-muted-foreground">
                  No agent suggestions available
                </div>
              )}
            </RadioGroup>
          </div>

          {selectedAgent && suggestions.length > 0 && selectedAgent !== suggestions[0]?.id && (
            <div className="space-y-2">
              <Label htmlFor="reason">Override Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you're choosing a different agent..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedAgent}>
            Assign to Selected Agent
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}