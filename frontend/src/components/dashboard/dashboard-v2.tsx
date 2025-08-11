'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Users,
  Ticket,
  TrendingUp,
  Clock,
  Brain,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Zap,
  Target,
  Award,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Minus,
  UserCheck,
  UserX,
  Timer,
  Sparkles,
  Bot,
  HandshakeIcon,
  TrendingDown
} from 'lucide-react'
import { useAssignmentStats, useAssignments } from '@/hooks/useAssignments'
import { useAgents } from '@/hooks/useAgents'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar
} from 'recharts'

export function DashboardV2() {
  const { stats, loading: statsLoading } = useAssignmentStats()
  const { agents, loading: agentsLoading, refreshAgents } = useAgents()
  const { assignmentHistory } = useAssignments()
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('7d') // 7d, 30d, 90d

  // Calculate real metrics
  const availableAgents = agents.filter(a => a.isAvailable).length
  const totalAgents = agents.length
  const activeAgents = agents.filter(a => a.isAvailable && a.currentTicketCount > 0).length
  const overloadedAgents = agents.filter(a => a.currentTicketCount > 8).length
  
  // Skill metrics
  const totalSkills = agents.reduce((acc, agent) => acc + (agent.skills?.length || 0), 0)
  const autoDetectedSkills = agents.reduce((acc, agent) => acc + (agent.autoDetectedSkills?.length || 0), 0)
  
  // Assignment metrics from history
  const recentAssignments = assignmentHistory.data?.slice(0, 50) || []
  const pendingAssignments = recentAssignments.filter(a => a.type === 'SUGGESTED').length
  const autoAssignments = recentAssignments.filter(a => a.type === 'AUTO').length
  const manualAssignments = recentAssignments.filter(a => a.type === 'MANUAL').length
  
  // Calculate average scores
  const avgScore = recentAssignments.length > 0
    ? (recentAssignments.reduce((acc, a) => acc + (a.score || 0), 0) / recentAssignments.length * 100).toFixed(1)
    : 0

  // Workload distribution data
  const workloadData = [
    { name: 'Low (0-3)', value: agents.filter(a => a.currentTicketCount <= 3).length, color: '#10b981' },
    { name: 'Medium (4-7)', value: agents.filter(a => a.currentTicketCount >= 4 && a.currentTicketCount <= 7).length, color: '#f59e0b' },
    { name: 'High (8+)', value: agents.filter(a => a.currentTicketCount >= 8).length, color: '#ef4444' },
  ]

  // Skills distribution
  const skillsData = [
    { name: 'Manual', value: totalSkills - autoDetectedSkills, color: '#3b82f6' },
    { name: 'Auto-Detected', value: autoDetectedSkills, color: '#8b5cf6' },
  ]

  // Time-based ticket trends (mock for now - should come from backend)
  const generateTrendData = () => {
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        assigned: Math.floor(Math.random() * 50) + 20,
        auto: Math.floor(Math.random() * 30) + 10,
        pending: Math.floor(Math.random() * 10) + 2,
      })
    }
    return data
  }

  const [trendData, setTrendData] = useState(generateTrendData())

  useEffect(() => {
    setTrendData(generateTrendData())
  }, [timeRange])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshAgents()
    // Refresh other data sources
    setTimeout(() => setRefreshing(false), 1000)
  }

  // Quick Actions
  const quickActions = [
    { label: 'Review Pending', count: pendingAssignments, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100', href: '/assignments' },
    { label: 'Detect Skills', count: totalAgents, icon: Brain, color: 'text-purple-600', bg: 'bg-purple-100', href: '/skills' },
    { label: 'Manage Agents', count: availableAgents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', href: '/agents' },
    { label: 'View History', count: recentAssignments.length, icon: Activity, color: 'text-green-600', bg: 'bg-green-100', href: '/assignments' },
  ]

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
            <p className="text-muted-foreground">
              Real-time overview of your ticket assignment system
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={timeRange} onValueChange={setTimeRange}>
              <TabsList>
                <TabsTrigger value="7d">7 Days</TabsTrigger>
                <TabsTrigger value="30d">30 Days</TabsTrigger>
                <TabsTrigger value="90d">90 Days</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Active Agents Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <div className="bg-green-100 rounded-full p-2">
                <UserCheck className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableAgents}/{totalAgents}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {activeAgents} currently working
              </div>
              <Progress value={(availableAgents / totalAgents) * 100} className="mt-2 h-1" />
            </CardContent>
          </Card>

          {/* Assignment Score Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Match Score</CardTitle>
              <div className="bg-blue-100 rounded-full p-2">
                <Target className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgScore}%</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                <span className="text-green-600">+2.3%</span> from last week
              </div>
            </CardContent>
          </Card>

          {/* Automation Rate Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Automation Rate</CardTitle>
              <div className="bg-purple-100 rounded-full p-2">
                <Bot className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {recentAssignments.length > 0 
                  ? `${((autoAssignments / recentAssignments.length) * 100).toFixed(0)}%`
                  : '0%'
                }
              </div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {autoAssignments} auto-assigned today
              </div>
            </CardContent>
          </Card>

          {/* Pending Reviews Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <div className="bg-orange-100 rounded-full p-2">
                <Clock className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingAssignments}</div>
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                Awaiting manual review
              </div>
              {pendingAssignments > 5 && (
                <Badge variant="destructive" className="mt-2 text-xs">Action needed</Badge>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-4">
          {quickActions.map((action) => (
            <Card 
              key={action.label} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => window.location.href = action.href}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("rounded-lg p-2", action.bg)}>
                      <action.icon className={cn("h-4 w-4", action.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{action.label}</p>
                      <p className="text-xs text-muted-foreground">{action.count} items</p>
                    </div>
                  </div>
                  <ArrowUp className="h-4 w-4 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Assignment Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Assignment Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorAuto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: '#888' }} />
                  <YAxis className="text-xs" tick={{ fill: '#888' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="assigned"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorAssigned)"
                    name="Total Assigned"
                  />
                  <Area
                    type="monotone"
                    dataKey="auto"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorAuto)"
                    name="Auto-Assigned"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Agent Workload Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-green-600" />
                Agent Workload Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={workloadData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {workloadData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Workload Stats */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                {workloadData.map((item) => (
                  <div key={item.name} className="text-center">
                    <div 
                      className="h-2 w-2 rounded-full mx-auto mb-1" 
                      style={{ backgroundColor: item.color }}
                    />
                    <p className="text-xs font-medium">{item.name}</p>
                    <p className="text-lg font-bold">{item.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Skills Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                Skills Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Skills</span>
                  <span className="font-bold">{totalSkills}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Manual</span>
                    <span>{totalSkills - autoDetectedSkills}</span>
                  </div>
                  <Progress 
                    value={((totalSkills - autoDetectedSkills) / totalSkills) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Auto-Detected</span>
                    <span>{autoDetectedSkills}</span>
                  </div>
                  <Progress 
                    value={(autoDetectedSkills / totalSkills) * 100} 
                    className="h-2 [&>div]:bg-purple-500"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href = '/skills'}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Detect More Skills
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-600" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">API Status</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-green-50">Healthy</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">Database</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-green-50">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
                    <span className="text-sm">Sync Status</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-yellow-50">2 hrs ago</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full animate-pulse",
                      overloadedAgents > 0 ? "bg-orange-500" : "bg-green-500"
                    )} />
                    <span className="text-sm">Workload</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      overloadedAgents > 0 ? "bg-orange-50" : "bg-green-50"
                    )}
                  >
                    {overloadedAgents > 0 ? `${overloadedAgents} overloaded` : 'Balanced'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAssignments.slice(0, 4).map((assignment, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      assignment.type === 'AUTO' ? "bg-green-500" :
                      assignment.type === 'MANUAL' ? "bg-blue-500" : "bg-orange-500"
                    )} />
                    <div className="flex-1 truncate">
                      <span className="font-medium">#{assignment.ticketId}</span>
                      <span className="text-muted-foreground ml-1">
                        {assignment.type === 'AUTO' ? 'auto-assigned' :
                         assignment.type === 'MANUAL' ? 'manually assigned' : 'pending'}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(assignment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2"
                  onClick={() => window.location.href = '/assignments'}
                >
                  View All Activity
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts Section */}
        {(pendingAssignments > 5 || overloadedAgents > 0) && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Action Required:</strong>
                  {pendingAssignments > 5 && (
                    <span className="ml-2">{pendingAssignments} assignments pending review.</span>
                  )}
                  {overloadedAgents > 0 && (
                    <span className="ml-2">{overloadedAgents} agents are overloaded.</span>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => window.location.href = '/assignments'}>
                  Review Now
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </MainLayout>
  )
}