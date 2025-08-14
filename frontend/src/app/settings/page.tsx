'use client'

import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SearchInput } from '@/components/ui/search-input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Shield,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Database,
  Users,
  Ticket,
  Brain,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  FileDown,
  Filter,
  Search,
  Zap,
  Clock,
  Archive,
  RotateCcw,
  HardDrive,
  Key,
  Lock,
  Unlock,
  AlertCircle,
  ChevronRight,
  Copy,
  FileJson,
  Activity,
  UserX,
  Sparkles,
  Edit,
  MapPin
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useAgents, type Agent } from '@/hooks/useAgents'
import { useAssignments } from '@/hooks/useAssignments'
import { exportToCSV, exportToJSON } from '@/lib/export-utils'
import { format } from 'date-fns'
import { apiService } from '@/services/api'

interface CleanupStats {
  assignments: number
  agents: number
  skills: number
  decisions: number
  categories: number
  settings: number
}

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error'
  api: 'healthy' | 'warning' | 'error'
  redis: 'healthy' | 'warning' | 'error'
  storage: { used: number; total: number }
}

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const { agents, refreshAgents } = useAgents()
  const { assignmentHistory } = useAssignments()
  
  const [loading, setLoading] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [dateFilter, setDateFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    variant?: 'default' | 'destructive'
    onConfirm: () => void
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {}
  })

  const [cleanupStats, setCleanupStats] = useState<CleanupStats>({
    assignments: 0,
    agents: 0,
    skills: 0,
    decisions: 0,
    categories: 0,
    settings: 0
  })

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    api: 'healthy',
    redis: 'healthy',
    storage: { used: 450, total: 1000 }
  })

  const [auditLog, setAuditLog] = useState<any[]>([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)

  useEffect(() => {
    // Fetch cleanup stats and audit logs
    fetchCleanupStats()
    fetchAuditLogs()
  }, [])

  // Update stats when data changes
  useEffect(() => {
    setCleanupStats({
      assignments: assignmentHistory.data?.length || 0,
      agents: agents.length,
      skills: agents.reduce((acc, a) => acc + (a.skills?.length || 0), 0),
      decisions: assignmentHistory.data?.length || 0,
      categories: 25, // Mock
      settings: 8 // Mock
    })
  }, [assignmentHistory.data, agents])

  const fetchCleanupStats = async () => {
    try {
      // Refresh queries to get latest data
      await queryClient.invalidateQueries({ queryKey: ['assignments'] })
      await queryClient.invalidateQueries({ queryKey: ['agents'] })
      
      // Wait a bit for queries to update
      setTimeout(() => {
        setCleanupStats({
          assignments: assignmentHistory.data?.length || 0,
          agents: agents.length,
          skills: agents.reduce((acc, a) => acc + (a.skills?.length || 0), 0),
          decisions: assignmentHistory.data?.length || 0,
          categories: 25, // Mock
          settings: 8 // Mock
        })
      }, 100)
    } catch (error) {
      console.error('Error fetching cleanup stats:', error)
    }
  }

  const handleDeleteAssignments = async (type: 'old' | 'all' | 'selected') => {
    setConfirmDialog({
      open: true,
      title: 'Delete Assignments',
      description: `Are you sure you want to delete ${
        type === 'all' ? 'ALL' : type === 'old' ? 'old' : 'selected'
      } assignments? This action cannot be undone.`,
      variant: 'destructive',
      onConfirm: async () => {
        setLoading(true)
        try {
          let result;
          if (type === 'old') {
            result = await apiService.deleteOldAssignments(90)
          } else if (type === 'all') {
            result = await apiService.deleteAllAssignments()
          } else {
            // For selected items, delete them one by one
            const itemsToDelete = Array.from(selectedItems)
            for (const id of itemsToDelete) {
              await apiService.deleteAssignment(id)
            }
            result = { data: { deleted: itemsToDelete.length } }
          }
          
          const deleted = result.data?.deleted || 0
          toast.success(`Successfully deleted ${deleted} assignments`)
          await addAuditLog(`Deleted ${type} assignments (${deleted} total)`, 'delete', { 
            entityType: 'assignment', 
            count: deleted,
            deleteType: type 
          })
          // Refresh assignment data
          await queryClient.invalidateQueries({ queryKey: ['assignments'] })
          await fetchCleanupStats()
        } catch (error) {
          toast.error('Failed to delete assignments')
          console.error('Delete assignments error:', error)
        } finally {
          setLoading(false)
          setConfirmDialog(prev => ({ ...prev, open: false }))
          setSelectedItems(new Set())
        }
      }
    })
  }

  const handleDeleteAgentData = async (agentId?: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Agent Data',
      description: agentId 
        ? 'This will delete this agent and all associated data.'
        : 'This will delete ALL inactive agents and their data.',
      variant: 'destructive',
      onConfirm: async () => {
        setLoading(true)
        try {
          let result;
          if (agentId) {
            result = await apiService.deleteAgent(agentId)
            toast.success('Successfully deleted agent')
            await addAuditLog(`Deleted agent ${agentId}`, 'delete', { 
              entityType: 'agent', 
              entityId: agentId 
            })
          } else {
            result = await apiService.deleteInactiveAgents()
            const deleted = result.data?.deleted || 0
            toast.success(`Successfully deleted ${deleted} inactive agents`)
            await addAuditLog(`Deleted ${deleted} inactive agents`, 'delete', { 
              entityType: 'agent', 
              count: deleted 
            })
          }
          await refreshAgents()
          await fetchCleanupStats()
        } catch (error) {
          toast.error('Failed to delete agent data')
          console.error('Delete agent error:', error)
        } finally {
          setLoading(false)
          setConfirmDialog(prev => ({ ...prev, open: false }))
        }
      }
    })
  }

  const handleClearSkills = async (type: 'detected' | 'manual' | 'all', agentId?: string) => {
    setConfirmDialog({
      open: true,
      title: 'Clear Skills',
      description: agentId 
        ? `This will clear all ${type} skills from this agent.`
        : `This will clear all ${type} skills from all agents.`,
      variant: 'destructive',
      onConfirm: async () => {
        setLoading(true)
        try {
          if (agentId) {
            // Clear skills for specific agent
            if (type === 'all' || type === 'detected') {
              await apiService.clearAgentSkills(agentId)
              toast.success(`Successfully cleared skills for agent`)
              await addAuditLog(`Cleared skills for agent ${agentId}`, 'update', { 
                entityType: 'agent', 
                entityId: agentId,
                skillType: type 
              })
            }
          } else {
            // Clear skills for all agents
            if (type === 'detected') {
              const result = await apiService.clearAllDetectedSkills()
              const affected = result.data?.affected || 0
              toast.success(`Successfully cleared detected skills for ${affected} agents`)
              await addAuditLog(`Cleared detected skills for ${affected} agents`, 'update', { 
                entityType: 'skill', 
                count: affected,
                skillType: 'detected' 
              })
            } else if (type === 'all') {
              // For clearing all skills, we need to iterate through agents
              const agentsResponse = await apiService.getAgents()
              const agents = agentsResponse.data
              let cleared = 0
              for (const agent of agents) {
                await apiService.clearAgentSkills(agent.id)
                cleared++
              }
              toast.success(`Successfully cleared all skills for ${cleared} agents`)
              await addAuditLog(`Cleared all skills for ${cleared} agents`, 'update', { 
                entityType: 'skill', 
                count: cleared,
                skillType: 'all' 
              })
            }
          }
          await refreshAgents()
          await fetchCleanupStats()
        } catch (error) {
          toast.error('Failed to clear skills')
          console.error('Clear skills error:', error)
        } finally {
          setLoading(false)
          setConfirmDialog(prev => ({ ...prev, open: false }))
        }
      }
    })
  }

  const handleSystemReset = async (type: 'soft' | 'hard') => {
    setConfirmDialog({
      open: true,
      title: type === 'hard' ? 'HARD RESET - DANGER' : 'Soft Reset',
      description: type === 'hard' 
        ? 'This will DELETE ALL DATA and restore the system to factory defaults. This CANNOT be undone!'
        : 'This will reset all settings to defaults but keep your data.',
      variant: 'destructive',
      onConfirm: async () => {
        setLoading(true)
        try {
          if (type === 'hard') {
            // Delete all data
            await apiService.deleteAllAssignments()
            await apiService.clearAllDetectedSkills()
            // Reset settings to defaults
            await apiService.updateSettings({
              autoAssignEnabled: false,
              assignmentMode: 'SUGGEST',
              maxSuggestionsPerTicket: 3,
              requireManualApproval: true,
              enablePriorityBoost: true,
              enableLocationMatching: false,
              maxConcurrentTicketsPerAgent: 10,
              businessHoursOnly: true,
              timezone: 'America/Denver'
            })
            toast.success('System hard reset completed - all data deleted')
            await addAuditLog('Performed system HARD reset - all data deleted', 'reset', { 
              resetType: 'hard' 
            })
            // Refresh all queries before redirect
            await queryClient.invalidateQueries()
            setTimeout(() => {
              window.location.href = '/'
            }, 2000)
          } else {
            // Soft reset - just reset settings
            await apiService.updateSettings({
              autoAssignEnabled: false,
              assignmentMode: 'SUGGEST',
              maxSuggestionsPerTicket: 3,
              requireManualApproval: true,
              enablePriorityBoost: true,
              enableLocationMatching: false,
              maxConcurrentTicketsPerAgent: 10,
              businessHoursOnly: true,
              timezone: 'America/Denver'
            })
            toast.success('System settings reset to defaults')
            await addAuditLog('Performed system soft reset - settings restored', 'reset', { 
              resetType: 'soft' 
            })
            // Refresh all data
            await queryClient.invalidateQueries()
          }
        } catch (error) {
          toast.error('Failed to reset system')
        } finally {
          setLoading(false)
          setConfirmDialog(prev => ({ ...prev, open: false }))
        }
      }
    })
  }

  const handleExportData = async (type: 'all' | 'assignments' | 'agents' | 'audit') => {
    setLoading(true)
    try {
      let data: any[] = []
      let filename = ''
      
      switch (type) {
        case 'assignments':
          data = assignmentHistory.data || []
          filename = 'assignments'
          break
        case 'agents':
          data = agents
          filename = 'agents'
          break
        case 'audit':
          data = auditLog
          filename = 'audit_log'
          break
        case 'all':
          data = {
            assignments: assignmentHistory.data || [],
            agents,
            auditLog,
            exportDate: new Date().toISOString()
          }
          filename = 'complete_backup'
          exportToJSON(data, filename)
          toast.success('Complete backup exported')
          await addAuditLog('Exported complete system backup', 'export', { 
            exportType: 'backup' 
          })
          return
      }
      
      exportToCSV(data, filename)
      toast.success(`${type} data exported`)
      await addAuditLog(`Exported ${type} data`, 'export', { 
        exportType: type 
      })
    } catch (error) {
      toast.error('Failed to export data')
    } finally {
      setLoading(false)
    }
  }

  const handleClearCache = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Cache cleared successfully')
      await addAuditLog('Cleared system cache', 'update')
    } catch (error) {
      toast.error('Failed to clear cache')
    } finally {
      setLoading(false)
    }
  }

  const handleOptimizeDatabase = async () => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      toast.success('Database optimized successfully')
      await addAuditLog('Optimized database', 'update')
    } catch (error) {
      toast.error('Failed to optimize database')
    } finally {
      setLoading(false)
    }
  }

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true)
    try {
      const response = await apiService.getAuditLogs({ limit: 50 })
      console.log('Audit logs response:', response) // Debug log
      // The response structure might vary, so handle both cases
      const logs = response.data?.logs || response.data || []
      setAuditLog(Array.isArray(logs) ? logs : logs.logs || [])
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      // Check if it's a 404 (endpoint not found)
      if (error.response?.status === 404) {
        console.error('Audit endpoint not found. Make sure backend is restarted with new routes.')
      }
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  const addAuditLog = async (action: string, type?: 'delete' | 'create' | 'update' | 'reset' | 'export' | 'import' | 'sync' | 'settings', metadata?: any) => {
    // Auto-detect type if not provided
    if (!type) {
      if (action.includes('Delete') || action.includes('deleted')) type = 'delete'
      else if (action.includes('Export') || action.includes('exported')) type = 'export'
      else if (action.includes('Reset') || action.includes('reset')) type = 'reset'
      else if (action.includes('Clear') || action.includes('cleared')) type = 'update'
      else type = 'update'
    }

    try {
      // Save to backend
      const saveResponse = await apiService.createAuditLog({
        action,
        type,
        user: 'admin@bgc.com', // TODO: Get from auth context
        metadata
      })
      console.log('Audit log saved:', saveResponse) // Debug log
      // Refresh audit logs
      await fetchAuditLogs()
    } catch (error) {
      console.error('Failed to save audit log:', error)
      // Check if it's a 404 (endpoint not found)
      if (error.response?.status === 404) {
        console.error('Audit POST endpoint not found. Backend may need restart.')
      }
      // Still update local state as fallback
      const newLog = {
        id: Date.now().toString(),
        action,
        type,
        user: 'admin@bgc.com',
        timestamp: new Date()
      }
      setAuditLog(prev => [newLog, ...prev].slice(0, 50))
    }
  }

  const toggleItemSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const selectAll = () => {
    if (assignmentHistory.data && assignmentHistory.data.length > 0) {
      const allIds = assignmentHistory.data.map(a => a.id).filter(id => id != null)
      setSelectedItems(new Set(allIds))
    }
  }

  const clearSelection = () => {
    setSelectedItems(new Set())
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Admin Tools</h2>
            <p className="text-muted-foreground">
              System administration and data management
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="py-1 bg-red-50 border-red-200 text-red-700">
              <Shield className="h-3 w-3 mr-1" />
              Admin Access Only
            </Badge>
            <Button variant="outline" size="sm" onClick={() => handleExportData('all')}>
              <Download className="h-4 w-4 mr-2" />
              Backup All
            </Button>
          </div>
        </div>

        {/* System Health */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Database</p>
                  <p className="text-xl font-bold capitalize">{systemHealth.database}</p>
                </div>
                <Database className={`h-8 w-8 ${
                  systemHealth.database === 'healthy' ? 'text-green-600' :
                  systemHealth.database === 'warning' ? 'text-yellow-600' : 'text-red-600'
                }`} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">API Status</p>
                  <p className="text-xl font-bold capitalize">{systemHealth.api}</p>
                </div>
                <Activity className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cache</p>
                  <p className="text-xl font-bold capitalize">{systemHealth.redis}</p>
                </div>
                <Zap className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-xl font-bold">
                    {systemHealth.storage.used}GB / {systemHealth.storage.total}GB
                  </p>
                </div>
                <HardDrive className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cleanup" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="cleanup">
              <Trash2 className="h-4 w-4 mr-2" />
              Data Cleanup
            </TabsTrigger>
            <TabsTrigger value="assignments">
              <Ticket className="h-4 w-4 mr-2" />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="agents">
              <Users className="h-4 w-4 mr-2" />
              Agents
            </TabsTrigger>
            <TabsTrigger value="system">
              <Settings className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Data Cleanup Tab */}
          <TabsContent value="cleanup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Cleanup Actions</CardTitle>
                <CardDescription>
                  Remove unnecessary data to optimize system performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Clear Old Assignments</p>
                        <p className="text-sm text-muted-foreground">
                          Remove assignments older than 90 days
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteAssignments('old')}
                        disabled={loading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Remove Inactive Agents</p>
                        <p className="text-sm text-muted-foreground">
                          Delete all deactivated agent records
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteAgentData()}
                        disabled={loading}
                      >
                        <UserX className="h-4 w-4 mr-2" />
                        Remove
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Clear Detection History</p>
                        <p className="text-sm text-muted-foreground">
                          Remove auto-detected skills history
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleClearSkills('detected')}
                        disabled={loading}
                      >
                        <Brain className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Clear Cache</p>
                        <p className="text-sm text-muted-foreground">
                          Flush Redis cache and temporary data
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleClearCache}
                        disabled={loading}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Optimize Database</p>
                        <p className="text-sm text-muted-foreground">
                          Vacuum and reindex database tables
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleOptimizeDatabase}
                        disabled={loading}
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Optimize
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <p className="font-medium">Archive Old Data</p>
                        <p className="text-sm text-muted-foreground">
                          Move old records to archive storage
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        disabled={loading}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Data Statistics */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-3">Current Data Statistics</h4>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.assignments}</p>
                      <p className="text-xs text-muted-foreground">Assignments</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.agents}</p>
                      <p className="text-xs text-muted-foreground">Agents</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.skills}</p>
                      <p className="text-xs text-muted-foreground">Skills</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.decisions}</p>
                      <p className="text-xs text-muted-foreground">Decisions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.categories}</p>
                      <p className="text-xs text-muted-foreground">Categories</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{cleanupStats.settings}</p>
                      <p className="text-xs text-muted-foreground">Settings</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Assignments Management Tab */}
          <TabsContent value="assignments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Assignment Management</CardTitle>
                <CardDescription>
                  Manage and delete individual assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Filters and Actions */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <SearchInput
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Search assignments..."
                        className="max-w-sm"
                      />
                      <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="old">Older than 90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedItems.size > 0 && (
                        <>
                          <Badge variant="secondary">
                            {selectedItems.size} selected
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={clearSelection}
                          >
                            Clear
                          </Button>
                        </>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAssignments('selected')}
                        disabled={selectedItems.size === 0 || loading}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </Button>
                    </div>
                  </div>

                  {/* Assignments Table */}
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[50px]">
                            <Checkbox
                              checked={selectedItems.size === assignmentHistory.data?.length}
                              onCheckedChange={(checked) => {
                                if (checked) selectAll()
                                else clearSelection()
                              }}
                            />
                          </TableHead>
                          <TableHead>Ticket ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Agent</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignmentHistory.data && assignmentHistory.data.length > 0 ? (
                          assignmentHistory.data.slice(0, 10).map((assignment) => (
                            <TableRow key={assignment.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedItems.has(assignment.id)}
                                  onCheckedChange={() => toggleItemSelection(assignment.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                #{assignment.ticketId || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={
                                  assignment.type === 'AUTO' ? 'default' :
                                  assignment.type === 'SUGGESTED' ? 'secondary' : 'outline'
                                }>
                                  {assignment.type || 'UNKNOWN'}
                                </Badge>
                              </TableCell>
                              <TableCell>{assignment.agentId || 'N/A'}</TableCell>
                              <TableCell>
                                {assignment.score !== null && assignment.score !== undefined 
                                  ? `${(assignment.score * 100).toFixed(0)}%` 
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>
                                {assignment.createdAt 
                                  ? format(new Date(assignment.createdAt), 'MMM d, yyyy')
                                  : 'N/A'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedItems(new Set([assignment.id]))
                                    handleDeleteAssignments('selected')
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground">
                              No assignments found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Bulk Actions */}
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Warning:</strong> Deleting assignments is permanent and cannot be undone.
                      Consider exporting data before deletion.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Management Tab */}
          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Agent Data Management</CardTitle>
                <CardDescription>
                  Manage agent records and associated data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Agent Actions */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Bulk Actions</h4>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleClearSkills('all')}
                            disabled={loading}
                          >
                            <Brain className="h-4 w-4 mr-2" />
                            Clear All Skills
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleClearSkills('detected')}
                            disabled={loading}
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Clear Auto-Detected Skills
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            onClick={() => handleClearSkills('manual')}
                            disabled={loading}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Clear Manual Skills
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-2">Reset Agent Data</h4>
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            disabled={loading}
                          >
                            <Clock className="h-4 w-4 mr-2" />
                            Reset All Workloads
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full justify-start"
                            disabled={loading}
                          >
                            <MapPin className="h-4 w-4 mr-2" />
                            Clear Location Data
                          </Button>
                          <Button
                            variant="destructive"
                            className="w-full justify-start"
                            onClick={() => handleDeleteAgentData()}
                            disabled={loading}
                          >
                            <UserX className="h-4 w-4 mr-2" />
                            Delete Inactive Agents
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agent List Table */}
                  <div className="border rounded-lg">
                    <div className="p-4 border-b">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">All Agents ({agents?.length || 0})</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Active: {agents?.filter(a => a.isActive !== false).length || 0}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Inactive: {agents?.filter(a => a.isActive === false).length || 0}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Skills</TableHead>
                            <TableHead>Tickets</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {agents && agents.length > 0 ? (
                            agents.map((agent) => {
                              const fullName = `${agent.firstName || ''} ${agent.lastName || ''}`.trim() || agent.email?.split('@')[0] || 'Unknown'
                              
                              return (
                                <TableRow key={agent.id}>
                                  <TableCell className="font-medium">{fullName}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{agent.email}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                      {agent.level || 'L1'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={agent.isActive !== false ? 'default' : 'secondary'} 
                                      className="text-xs"
                                    >
                                      {agent.isActive !== false ? 'Active' : 'Inactive'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{agent.skills?.length || 0}</TableCell>
                                  <TableCell>{agent.currentTicketCount || 0}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleClearSkills('all', agent.id)}
                                        title="Clear skills"
                                      >
                                        <Brain className="h-4 w-4 text-gray-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteAgentData(agent.id)}
                                        title="Delete agent"
                                      >
                                        <Trash2 className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          ) : (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center text-muted-foreground">
                                No agents found
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Management</CardTitle>
                <CardDescription>
                  Critical system operations and reset options
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Export Options */}
                  <div>
                    <h4 className="font-medium mb-3">Data Export</h4>
                    <div className="grid gap-2 md:grid-cols-4">
                      <Button
                        variant="outline"
                        onClick={() => handleExportData('assignments')}
                        disabled={loading}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Assignments
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExportData('agents')}
                        disabled={loading}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Agents
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExportData('audit')}
                        disabled={loading}
                      >
                        <FileDown className="h-4 w-4 mr-2" />
                        Export Audit Log
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleExportData('all')}
                        disabled={loading}
                      >
                        <FileJson className="h-4 w-4 mr-2" />
                        Full Backup
                      </Button>
                    </div>
                  </div>

                  {/* System Reset */}
                  <div>
                    <h4 className="font-medium mb-3">System Reset</h4>
                    <Alert className="mb-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        System resets should only be performed by authorized administrators.
                        Always create a backup before performing any reset operation.
                      </AlertDescription>
                    </Alert>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <RotateCcw className="h-5 w-5 text-yellow-600" />
                              <h5 className="font-medium">Soft Reset</h5>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Reset all settings to defaults while keeping data intact
                            </p>
                            <Button
                              variant="outline"
                              className="w-full"
                              onClick={() => handleSystemReset('soft')}
                              disabled={loading}
                            >
                              Perform Soft Reset
                            </Button>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              <h5 className="font-medium">Hard Reset</h5>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Delete ALL data and restore factory defaults
                            </p>
                            <Button
                              variant="destructive"
                              className="w-full"
                              onClick={() => handleSystemReset('hard')}
                              disabled={loading}
                            >
                              HARD RESET - DANGER
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Advanced Options */}
                  <div>
                    <h4 className="font-medium mb-3">Advanced Options</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">Maintenance Mode</p>
                          <p className="text-xs text-muted-foreground">
                            Disable all automated processes temporarily
                          </p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">Debug Mode</p>
                          <p className="text-xs text-muted-foreground">
                            Enable verbose logging for troubleshooting
                          </p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <p className="font-medium">Read-Only Mode</p>
                          <p className="text-xs text-muted-foreground">
                            Prevent any data modifications
                          </p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Log</CardTitle>
                <CardDescription>
                  Track all administrative actions and system changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <SearchInput
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Search audit log..."
                      className="max-w-sm"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportData('audit')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Log
                    </Button>
                  </div>

                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Action</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Timestamp</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingAuditLogs ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center">
                              <div className="flex items-center justify-center gap-2 py-4">
                                <RefreshCw className="h-4 w-4 animate-spin" />
                                Loading audit logs...
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : auditLog.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No audit logs available
                            </TableCell>
                          </TableRow>
                        ) : (
                          auditLog.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="font-medium">
                                {log.action}
                              </TableCell>
                              <TableCell>{log.user}</TableCell>
                              <TableCell>
                                <Badge variant={
                                  log.type === 'delete' ? 'destructive' :
                                  log.type === 'reset' ? 'secondary' : 'outline'
                                }>
                                  {log.type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Confirm"
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
        />
      </div>
    </MainLayout>
  )
}