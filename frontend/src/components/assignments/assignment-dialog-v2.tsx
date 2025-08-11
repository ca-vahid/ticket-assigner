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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Briefcase, 
  TrendingUp, 
  MapPin, 
  Clock,
  Ticket,
  Sparkles,
  AlertCircle,
  Award,
  Activity,
  Zap,
  CheckCircle,
  XCircle,
  Brain,
  Star,
  Hash,
  Calendar,
  Users,
  Target
} from 'lucide-react'
import { useAgents } from '@/hooks/useAgents'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignment: any
  onAssign: (ticketId: string, agentId: string, reason?: string) => void
}

export function AssignmentDialogV2({
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
          firstName: primaryAgent.firstName,
          lastName: primaryAgent.lastName,
          score: assignment.score || 0,
          skills: primaryAgent.skills || [],
          currentTicketCount: primaryAgent.currentTicketCount || 0,
          weightedTicketCount: primaryAgent.weightedTicketCount || 0,
          level: primaryAgent.level,
          isAvailable: primaryAgent.isAvailable,
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
            firstName: agent.firstName,
            lastName: agent.lastName,
            score: alt.totalScore || alt.score || 0,
            skills: agent.skills || [],
            currentTicketCount: agent.currentTicketCount || 0,
            weightedTicketCount: agent.weightedTicketCount || 0,
            level: agent.level,
            isAvailable: agent.isAvailable,
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
            weightedTicketCount: 0,
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

  const getWorkloadColor = (count: number) => {
    if (count > 8) return 'text-red-600 bg-red-50 border-red-200'
    if (count > 5) return 'text-orange-600 bg-orange-50 border-orange-200'
    return 'text-green-600 bg-green-50 border-green-200'
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500'
    if (score >= 0.6) return 'bg-yellow-500'
    return 'bg-orange-500'
  }

  const isOverriding = selectedAgent && suggestions.length > 0 && selectedAgent !== suggestions[0]?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-blue-600" />
            Assignment Review
          </DialogTitle>
          <DialogDescription className="space-y-2 pt-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                {assignment.ticketId}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
              </Badge>
            </div>
            <p className="font-medium text-base text-foreground">
              {assignment.ticketSubject || assignment.subject || 'Untitled Ticket'}
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <Users className="h-5 w-5 mx-auto mb-1 text-blue-600" />
              <p className="text-sm font-medium">{suggestions.length}</p>
              <p className="text-xs text-muted-foreground">Options</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <Brain className="h-5 w-5 mx-auto mb-1 text-purple-600" />
              <p className="text-sm font-medium">
                {suggestions[0] ? `${(suggestions[0].score * 100).toFixed(0)}%` : 'N/A'}
              </p>
              <p className="text-xs text-muted-foreground">Top Match</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <Target className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-sm font-medium">Auto</p>
              <p className="text-xs text-muted-foreground">Suggested</p>
            </div>
          </div>

          {/* Agent Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Select Agent for Assignment
            </h3>
            
            <RadioGroup value={selectedAgent} onValueChange={setSelectedAgent}>
              {suggestions.length > 0 ? suggestions.map((agent: any, index: number) => {
                const workloadPercent = (agent.currentTicketCount || 0) * 10
                const isOverloaded = agent.currentTicketCount > 8
                
                return (
                  <div
                    key={agent.id}
                    className={cn(
                      "relative rounded-lg border-2 transition-all",
                      selectedAgent === agent.id 
                        ? "border-blue-500 shadow-lg bg-blue-50/30" 
                        : "border-gray-200 hover:border-gray-300",
                      agent.isPrimary && "ring-2 ring-green-500/20"
                    )}
                  >
                    {/* Recommended Badge */}
                    {agent.isPrimary && (
                      <div className="absolute -top-3 left-4 px-2 bg-green-500 text-white text-xs rounded-full font-medium flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        AI Recommended
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-start space-x-3">
                        <RadioGroupItem value={agent.id} id={agent.id} className="mt-1" />
                        <Label htmlFor={agent.id} className="flex-1 cursor-pointer">
                          <div className="space-y-3">
                            {/* Agent Header */}
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                                  agent.isPrimary ? "bg-gradient-to-br from-green-500 to-emerald-600" :
                                  index === 1 ? "bg-gradient-to-br from-blue-500 to-indigo-600" :
                                  "bg-gradient-to-br from-gray-500 to-slate-600"
                                )}>
                                  {agent.firstName?.[0]}{agent.lastName?.[0]}
                                </div>
                                <div>
                                  <p className="font-medium text-base">{agent.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant="outline" className="text-xs px-1.5 py-0">
                                      {agent.level || 'L1'}
                                    </Badge>
                                    {!agent.isAvailable && (
                                      <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                        Unavailable
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Score Badge */}
                              <div className="text-right">
                                <div className="flex items-center gap-1">
                                  <div className={cn(
                                    "h-2 w-2 rounded-full",
                                    getScoreColor(agent.score)
                                  )}></div>
                                  <span className="text-lg font-bold">
                                    {((agent.score || 0) * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">match score</p>
                              </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Workload Card */}
                              <div className={cn(
                                "rounded-lg border p-2",
                                getWorkloadColor(agent.currentTicketCount)
                              )}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    <span className="text-xs font-medium">Workload</span>
                                  </div>
                                  <span className="text-xs font-bold">
                                    {agent.currentTicketCount || 0}/10
                                  </span>
                                </div>
                                <Progress 
                                  value={workloadPercent} 
                                  className="h-1.5"
                                />
                                {isOverloaded && (
                                  <p className="text-xs mt-1 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    High Load
                                  </p>
                                )}
                              </div>

                              {/* Skills Preview */}
                              <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                                <div className="flex items-center gap-1 mb-1">
                                  <Briefcase className="h-3 w-3 text-gray-600" />
                                  <span className="text-xs font-medium text-gray-700">
                                    Skills ({agent.skills?.length || 0})
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {agent.skills?.slice(0, 3).map((skill: string, i: number) => (
                                    <Badge 
                                      key={i} 
                                      variant="secondary" 
                                      className="text-xs px-1 py-0"
                                    >
                                      {skill.replace(/_/g, ' ')}
                                    </Badge>
                                  ))}
                                  {agent.skills?.length > 3 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{agent.skills.length - 3}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quick Decision Indicators */}
                            <div className="flex items-center gap-2 text-xs">
                              {agent.isPrimary && (
                                <Badge className="bg-green-100 text-green-700 border-green-300">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Best Match
                                </Badge>
                              )}
                              {agent.currentTicketCount <= 3 && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-300">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Low Load
                                </Badge>
                              )}
                              {agent.weightedTicketCount > 8 && (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Weighted: {Number(agent.weightedTicketCount).toFixed(1)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </div>
                )
              }) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No agent suggestions available</p>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Override Warning */}
          {isOverriding && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription>
                <strong>Override Notice:</strong> You're selecting a different agent than recommended. 
                Please provide a reason below.
              </AlertDescription>
            </Alert>
          )}

          {/* Override Reason */}
          {isOverriding && (
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium">
                Override Reason <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain why you're choosing a different agent..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="min-h-[80px]"
                required
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {selectedAgent === suggestions[0]?.id && (
              <Button 
                onClick={handleAssign} 
                disabled={!selectedAgent}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Assign
              </Button>
            )}
            {selectedAgent && selectedAgent !== suggestions[0]?.id && (
              <Button 
                onClick={handleAssign} 
                disabled={!selectedAgent || (isOverriding && !overrideReason)}
                variant="default"
              >
                <User className="h-4 w-4 mr-2" />
                Override & Assign
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}