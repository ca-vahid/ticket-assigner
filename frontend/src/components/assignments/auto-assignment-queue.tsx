'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { AlertCircle, Clock, CheckCircle, Settings } from 'lucide-react'
import { useAssignments } from '@/hooks/useAssignments'
import { formatDistanceToNow } from 'date-fns'
import { apiService } from '@/services/api'

export function AutoAssignmentQueue() {
  // Initialize from localStorage or default to true
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('autoAssignEnabled')
      return saved !== null ? saved === 'true' : true
    }
    return true
  })
  const [isSaving, setIsSaving] = useState(false)
  
  const { assignmentHistory } = useAssignments({ limit: 100 })
  
  // Load setting from backend on mount
  useEffect(() => {
    apiService.getSettings()
      .then(response => {
        if (response.data?.autoAssignEnabled !== undefined) {
          setAutoAssignEnabled(response.data.autoAssignEnabled)
          localStorage.setItem('autoAssignEnabled', String(response.data.autoAssignEnabled))
        }
      })
      .catch(error => {
        console.log('Using local setting, backend not available')
      })
  }, [])
  
  // Calculate statistics using useMemo for performance
  const stats = useMemo(() => {
    const data = assignmentHistory.data || []
    const autoAssigned = data.filter(a => a.type === 'AUTO_ASSIGNED')
    
    // Calculate average score properly
    let avgScore = 0
    if (autoAssigned.length > 0) {
      let totalScore = 0
      for (const item of autoAssigned) {
        // Ensure we're working with a number
        const score = parseFloat(String(item.score)) || 0
        totalScore += score
      }
      avgScore = Math.round((totalScore / autoAssigned.length) * 100)
    }
    
    return {
      totalCount: autoAssigned.length,
      averageScore: avgScore,
      recentTickets: autoAssigned
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
    }
  }, [assignmentHistory.data])
  
  const loading = assignmentHistory.isLoading

  // Handle toggle change
  const handleToggleChange = async (checked: boolean) => {
    setAutoAssignEnabled(checked)
    setIsSaving(true)
    
    // Save to localStorage immediately for responsiveness
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoAssignEnabled', String(checked))
    }
    
    // Also save to backend
    try {
      await apiService.updateSettings({ autoAssignEnabled: checked })
      console.log('Auto-assignment', checked ? 'enabled' : 'disabled')
    } catch (error) {
      console.error('Failed to update settings:', error)
      // Settings are still saved locally
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Auto-Assignment Configuration</CardTitle>
            </div>
            <div className="flex items-center space-x-3">
              <Label 
                htmlFor="auto-assign" 
                className="text-sm font-normal cursor-pointer"
              >
                Auto-Assignment
              </Label>
              <Switch 
                id="auto-assign" 
                checked={autoAssignEnabled}
                onCheckedChange={handleToggleChange}
                disabled={isSaving}
              />
              <Badge variant={autoAssignEnabled ? "default" : "secondary"}>
                {isSaving ? 'Saving...' : autoAssignEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Confidence Threshold
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">70%</p>
                <p className="text-xs text-muted-foreground">minimum</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Tickets above this score are auto-assigned
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Total Auto-Assigned
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {loading ? '...' : stats.totalCount}
                </p>
                <p className="text-xs text-muted-foreground">tickets</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully processed tickets
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Average Confidence
              </p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {loading ? '...' : stats.averageScore > 0 ? `${stats.averageScore}%` : '0%'}
                </p>
                <p className="text-xs text-muted-foreground">overall</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Average assignment confidence
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Assignments Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Auto-Assignments</CardTitle>
            {stats.totalCount > 0 && (
              <Badge variant="outline">
                Last 5 of {stats.totalCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted/50 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : stats.recentTickets.length > 0 ? (
            <div className="space-y-3">
              {stats.recentTickets.map((ticket, idx) => {
                const score = parseFloat(String(ticket.score)) || 0
                const scorePercent = Math.round(score * 100)
                
                return (
                  <div key={ticket.id} className="rounded-lg border bg-card p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            #{ticket.ticketId}
                          </Badge>
                          {idx === 0 && (
                            <Badge variant="default" className="text-xs">
                              Most Recent
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Auto-assigned
                          </Badge>
                        </div>
                        <p className="font-medium text-sm">
                          {ticket.ticketSubject || 'No subject'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-xs text-muted-foreground">Confidence</div>
                        <div className={`text-2xl font-bold ${
                          scorePercent >= 90 ? 'text-green-600' :
                          scorePercent >= 80 ? 'text-blue-600' :
                          scorePercent >= 70 ? 'text-yellow-600' :
                          'text-orange-600'
                        }`}>
                          {scorePercent}%
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium mb-2">No auto-assignments yet</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                When tickets are created with a confidence score above 70%, 
                they will be automatically assigned and appear here
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}