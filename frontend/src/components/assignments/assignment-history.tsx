'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  User,
  TrendingUp,
  Filter,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow, format } from 'date-fns'

const typeConfig = {
  AUTO_ASSIGNED: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Auto-Assigned',
    description: 'Automatically assigned based on high confidence'
  },
  SUGGESTED: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    label: 'Suggested',
    description: 'Pending manual review'
  },
  MANUAL_OVERRIDE: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    label: 'Manual Override',
    description: 'Manually reassigned by administrator'
  },
  REASSIGNED: {
    icon: AlertCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: 'Reassigned',
    description: 'Ticket was reassigned'
  }
}

export function AssignmentHistory() {
  const { assignmentHistory } = useAssignments({ limit: 50 })
  const { agents } = useAgents()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<string>('all')
  
  const assignments = assignmentHistory.data || []
  const loading = assignmentHistory.isLoading

  // Filter and group assignments
  const { filteredAssignments, stats } = useMemo(() => {
    const filtered = filterType === 'all' 
      ? assignments 
      : assignments.filter(a => a.type === filterType)
    
    const typeCount = assignments.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return {
      filteredAssignments: filtered,
      stats: {
        total: assignments.length,
        ...typeCount
      }
    }
  }, [assignments, filterType])

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-gray-100 rounded-lg"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-16">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium mb-2">No assignment history</h3>
            <p className="text-sm text-muted-foreground">
              Assignment decisions will appear here as tickets are processed
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div 
              className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${
                filterType === 'all' ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
              onClick={() => setFilterType('all')}
            >
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            {Object.entries(typeConfig).map(([type, config]) => (
              <div 
                key={type}
                className={`text-center p-3 rounded-lg cursor-pointer transition-colors ${
                  filterType === type ? config.bgColor : 'hover:bg-muted'
                }`}
                onClick={() => setFilterType(type)}
              >
                <div className={`text-2xl font-bold ${config.color}`}>
                  {stats[type] || 0}
                </div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {filterType === 'all' ? 'All Assignments' : typeConfig[filterType]?.label}
            </CardTitle>
            <Badge variant="secondary">
              {filteredAssignments.length} {filteredAssignments.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredAssignments.map((item) => {
              const agent = agents.find(a => a.id === item.agentId)
              const config = typeConfig[item.type] || typeConfig.AUTO_ASSIGNED
              const StatusIcon = config.icon
              const isExpanded = expandedItems.has(item.id)
              
              return (
                <div
                  key={item.id}
                  className="rounded-lg border hover:shadow-sm transition-all"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        {/* Header */}
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            #{item.ticketId}
                          </Badge>
                          <div className={`flex items-center gap-1 ${config.color}`}>
                            <StatusIcon className="h-4 w-4" />
                            <span className="text-xs font-medium">{config.label}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        
                        {/* Subject */}
                        <h4 className="font-medium">
                          {item.ticketSubject || 'Untitled Ticket'}
                        </h4>
                        
                        {/* Agent and Score */}
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Assigned to:</span>
                            <span className="font-medium">
                              {agent ? `${agent.firstName} ${agent.lastName}` : 'Unknown'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Confidence:</span>
                            <span className="font-medium">
                              {typeof item.score === 'number' 
                                ? `${Math.round(item.score * 100)}%`
                                : 'N/A'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Score Breakdown (when expanded) */}
                        {isExpanded && item.scoreBreakdown && (
                          <div className="pt-3 mt-3 border-t">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Score Breakdown
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              {Object.entries(item.scoreBreakdown).map(([key, value]) => (
                                <div key={key} className="text-center p-2 bg-muted/50 rounded">
                                  <div className="text-sm font-medium">
                                    {typeof value === 'number' 
                                      ? `${Math.round(value * 100)}%`
                                      : 'N/A'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {key.replace(/([A-Z])/g, ' $1').replace('Score', '').trim()}
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Additional Details */}
                            <div className="mt-3 text-xs text-muted-foreground">
                              <div>Created: {format(new Date(item.createdAt), 'PPpp')}</div>
                              {item.updatedAt && (
                                <div>Updated: {format(new Date(item.updatedAt), 'PPpp')}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}