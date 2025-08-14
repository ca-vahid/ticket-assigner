'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Shield,
  Settings,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  UserCheck,
  UserX,
  Globe,
  Building,
  Trash2,
  Timer,
  CalendarOff,
  Filter,
  Activity,
  TrendingUp,
  BarChart3,
  Home,
  Briefcase,
  Plane,
  RefreshCw
} from 'lucide-react'
import { useAgents } from '@/hooks/useAgents'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { cn } from '@/lib/utils'
import { apiService } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import dynamic from 'next/dynamic'
import { LocationConfigDialog } from '@/components/locations/location-config-dialog'

// Dynamic import for Leaflet (client-side only)
const LeafletMap = dynamic(
  () => import('@/components/locations/leaflet-map'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
          <p>Loading map...</p>
        </div>
      </div>
    )
  }
)

interface EligibilityRule {
  id: string
  name: string
  description: string
  enabled: boolean
  type: 'availability' | 'location' | 'workload' | 'skills' | 'time'
  icon: any
  color: string
  config?: any
}

interface AgentAvailability {
  agentId: string
  agentName: string
  status: 'available' | 'busy' | 'pto' | 'offline'
  currentLoad: number
  maxLoad: number
  location: string
  ptoStart?: Date
  ptoEnd?: Date
}

export default function EligibilityPage() {
  const { agents } = useAgents()
  const [hasChanges, setHasChanges] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState(new Date())
  const [isSyncingLocations, setIsSyncingLocations] = useState(false)
  const [configLocation, setConfigLocation] = useState<any>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  // Fetch locations from API
  const { data: locations = [], refetch: refetchLocations } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await apiService.getLocations()
      return response.data || []
    }
  })

  // Fetch location stats
  const { data: locationStats, refetch: refetchLocationStats } = useQuery({
    queryKey: ['location-stats'],
    queryFn: async () => {
      const response = await apiService.getLocationStats()
      return response.data
    }
  })

  const [rules, setRules] = useState<EligibilityRule[]>([
    {
      id: 'availability_check',
      name: 'Availability Check',
      description: 'Only assign tickets to agents who are currently available',
      enabled: true,
      type: 'availability',
      icon: UserCheck,
      color: 'text-green-600',
      config: {
        checkPTO: true,
        checkWorkingHours: true,
        respectTimezones: true
      }
    },
    {
      id: 'workload_limit',
      name: 'Workload Limit',
      description: 'Prevent assignment if agent has too many active tickets',
      enabled: true,
      type: 'workload',
      icon: Activity,
      color: 'text-blue-600',
      config: {
        maxTickets: 10,
        warningThreshold: 8
      }
    },
    {
      id: 'location_matching',
      name: 'Location Matching',
      description: 'Prefer agents in the same location as the ticket',
      enabled: true,
      type: 'location',
      icon: MapPin,
      color: 'text-orange-600',
      config: {
        strictMatching: false,
        allowRemote: true,
        preferredLocations: ['Vancouver', 'Toronto']
      }
    },
    {
      id: 'skill_requirement',
      name: 'Skill Requirement',
      description: 'Only assign to agents with required skills',
      enabled: true,
      type: 'skills',
      icon: Shield,
      color: 'text-purple-600',
      config: {
        minimumMatch: 80,
        requireAllSkills: false
      }
    },
    {
      id: 'business_hours',
      name: 'Business Hours',
      description: 'Only assign during business hours',
      enabled: true,
      type: 'time',
      icon: Clock,
      color: 'text-yellow-600',
      config: {
        startHour: 8,
        endHour: 18,
        weekendsAllowed: false
      }
    }
  ])

  // Mock PTO data
  const [ptoData] = useState([
    { agentId: '1', agentName: 'John Doe', start: new Date(), end: addDays(new Date(), 3), type: 'vacation' },
    { agentId: '2', agentName: 'Jane Smith', start: addDays(new Date(), 5), end: addDays(new Date(), 7), type: 'sick' },
    { agentId: '3', agentName: 'Bob Wilson', start: addDays(new Date(), 10), end: addDays(new Date(), 14), type: 'vacation' }
  ])

  // Location distribution - use real data from API
  const locationData = React.useMemo(() => {
    if (!locationStats?.byLocation) {
      return []
    }
    
    const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#6366f1']
    return Object.entries(locationStats.byLocation).map(([name, value], index) => ({
      name,
      value: value as number,
      color: colors[index % colors.length]
    }))
  }, [locationStats])

  // Eligibility impact data
  const impactData = [
    { rule: 'Availability', filtered: 3, passed: 32 },
    { rule: 'Workload', filtered: 5, passed: 30 },
    { rule: 'Location', filtered: 2, passed: 33 },
    { rule: 'Skills', filtered: 8, passed: 27 },
    { rule: 'Hours', filtered: 1, passed: 34 }
  ]

  const toggleRule = (ruleId: string) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ))
    setHasChanges(true)
  }

  const updateRuleConfig = (ruleId: string, config: any) => {
    setRules(prev => prev.map(rule => 
      rule.id === ruleId ? { ...rule, config: { ...rule.config, ...config } } : rule
    ))
    setHasChanges(true)
  }

  const saveRules = async () => {
    // API call to save rules
    console.log('Saving rules:', rules)
    setHasChanges(false)
  }

  // Generate calendar data
  const generateCalendarData = () => {
    const start = startOfWeek(selectedWeek)
    const days = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i)
      const ptoAgents = ptoData.filter(pto => 
        date >= pto.start && date <= pto.end
      ).length
      days.push({
        date,
        dayName: format(date, 'EEE'),
        dayNumber: format(date, 'd'),
        ptoCount: ptoAgents,
        availableCount: agents.length - ptoAgents
      })
    }
    return days
  }

  const calendarData = generateCalendarData()

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Eligibility Rules</h2>
            <p className="text-muted-foreground">
              Configure rules that determine agent eligibility for ticket assignments
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Badge variant="outline" className="bg-yellow-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved changes
              </Badge>
            )}
            <Button size="sm" onClick={saveRules} disabled={!hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="rules" className="space-y-4">
          <TabsList>
            <TabsTrigger value="rules">
              <Settings className="h-4 w-4 mr-2" />
              Rule Configuration
            </TabsTrigger>
            <TabsTrigger value="availability">
              <Calendar className="h-4 w-4 mr-2" />
              Availability Calendar
            </TabsTrigger>
            <TabsTrigger value="locations">
              <MapPin className="h-4 w-4 mr-2" />
              Location Settings
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Impact Analysis
            </TabsTrigger>
          </TabsList>

          {/* Rules Configuration Tab */}
          <TabsContent value="rules" className="space-y-6">
            <div className="grid gap-4">
              {rules.map((rule) => (
                <Card key={rule.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg", 
                          rule.enabled ? "bg-blue-100" : "bg-gray-100"
                        )}>
                          {(() => {
                            const RuleIcon = rule.icon
                            return <RuleIcon className={cn("h-5 w-5", rule.enabled ? rule.color : "text-gray-400")} />
                          })()}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{rule.name}</CardTitle>
                          <CardDescription>{rule.description}</CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                    </div>
                  </CardHeader>
                  {rule.enabled && (
                    <CardContent>
                      <div className="space-y-4">
                        {/* Availability Check Config */}
                        {rule.id === 'availability_check' && (
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Check PTO</Label>
                              <Switch
                                checked={rule.config.checkPTO}
                                onCheckedChange={(checked) => 
                                  updateRuleConfig(rule.id, { checkPTO: checked })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Check Working Hours</Label>
                              <Switch
                                checked={rule.config.checkWorkingHours}
                                onCheckedChange={(checked) => 
                                  updateRuleConfig(rule.id, { checkWorkingHours: checked })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Respect Timezones</Label>
                              <Switch
                                checked={rule.config.respectTimezones}
                                onCheckedChange={(checked) => 
                                  updateRuleConfig(rule.id, { respectTimezones: checked })
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Workload Limit Config */}
                        {rule.id === 'workload_limit' && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-sm">Max Tickets per Agent</Label>
                              <Input
                                type="number"
                                value={rule.config.maxTickets}
                                onChange={(e) => 
                                  updateRuleConfig(rule.id, { maxTickets: parseInt(e.target.value) })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Warning Threshold</Label>
                              <Input
                                type="number"
                                value={rule.config.warningThreshold}
                                onChange={(e) => 
                                  updateRuleConfig(rule.id, { warningThreshold: parseInt(e.target.value) })
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Location Matching Config */}
                        {rule.id === 'location_matching' && (
                          <div className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Strict Matching</Label>
                                <Switch
                                  checked={rule.config.strictMatching}
                                  onCheckedChange={(checked) => 
                                    updateRuleConfig(rule.id, { strictMatching: checked })
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label className="text-sm">Allow Remote Agents</Label>
                                <Switch
                                  checked={rule.config.allowRemote}
                                  onCheckedChange={(checked) => 
                                    updateRuleConfig(rule.id, { allowRemote: checked })
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Preferred Locations</Label>
                              <div className="flex flex-wrap gap-2">
                                {locations.map(location => (
                                  <Badge
                                    key={location.id}
                                    variant={rule.config.preferredLocations?.includes(location.name) ? 'default' : 'outline'}
                                    className="cursor-pointer"
                                    onClick={() => {
                                      const selectedLocations = rule.config.preferredLocations || []
                                      updateRuleConfig(rule.id, {
                                        preferredLocations: selectedLocations.includes(location.name)
                                          ? selectedLocations.filter((l: string) => l !== location.name)
                                          : [...selectedLocations, location.name]
                                      })
                                    }}
                                  >
                                    {location.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Skill Requirement Config */}
                        {rule.id === 'skill_requirement' && (
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-sm">Minimum Match %</Label>
                              <Input
                                type="number"
                                value={rule.config.minimumMatch}
                                onChange={(e) => 
                                  updateRuleConfig(rule.id, { minimumMatch: parseInt(e.target.value) })
                                }
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Require All Skills</Label>
                              <Switch
                                checked={rule.config.requireAllSkills}
                                onCheckedChange={(checked) => 
                                  updateRuleConfig(rule.id, { requireAllSkills: checked })
                                }
                              />
                            </div>
                          </div>
                        )}

                        {/* Business Hours Config */}
                        {rule.id === 'business_hours' && (
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label className="text-sm">Start Hour</Label>
                              <Select
                                value={rule.config.startHour.toString()}
                                onValueChange={(value) => 
                                  updateRuleConfig(rule.id, { startHour: parseInt(value) })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i.toString().padStart(2, '0')}:00
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">End Hour</Label>
                              <Select
                                value={rule.config.endHour.toString()}
                                onValueChange={(value) => 
                                  updateRuleConfig(rule.id, { endHour: parseInt(value) })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>
                                      {i.toString().padStart(2, '0')}:00
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Allow Weekends</Label>
                              <Switch
                                checked={rule.config.weekendsAllowed}
                                onCheckedChange={(checked) => 
                                  updateRuleConfig(rule.id, { weekendsAllowed: checked })
                                }
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>

            {/* Rule Summary */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>{rules.filter(r => r.enabled).length}</strong> rules are currently active.
                These rules are applied in order to filter eligible agents before scoring.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Availability Calendar Tab */}
          <TabsContent value="availability" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Calendar View */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Team Availability Calendar</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWeek(new Date())}
                      >
                        Today
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {calendarData.map((day) => (
                      <div
                        key={day.dayName}
                        className={cn(
                          "p-3 rounded-lg border text-center",
                          isSameDay(day.date, new Date()) && "bg-blue-50 border-blue-300"
                        )}
                      >
                        <p className="text-xs text-muted-foreground">{day.dayName}</p>
                        <p className="text-lg font-bold">{day.dayNumber}</p>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <UserCheck className="h-3 w-3 text-green-600" />
                            <span className="text-xs text-green-600">{day.availableCount}</span>
                          </div>
                          {day.ptoCount > 0 && (
                            <div className="flex items-center justify-center gap-1">
                              <UserX className="h-3 w-3 text-orange-600" />
                              <span className="text-xs text-orange-600">{day.ptoCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* PTO List */}
                  <div className="mt-6 space-y-2">
                    <h4 className="text-sm font-medium">Upcoming Time Off</h4>
                    {ptoData.map((pto) => (
                      <div key={pto.agentId} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <Badge variant={pto.type === 'vacation' ? 'default' : 'secondary'}>
                            {pto.type === 'vacation' ? <Plane className="h-3 w-3 mr-1" /> : <Home className="h-3 w-3 mr-1" />}
                            {pto.type}
                          </Badge>
                          <span className="text-sm font-medium">{pto.agentName}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(pto.start, 'MMM d')} - {format(pto.end, 'MMM d')}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Availability Stats */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Current Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                          <span className="text-sm">Available</span>
                        </div>
                        <span className="font-bold">{agents.filter(a => a.isAvailable).length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-yellow-500 rounded-full" />
                          <span className="text-sm">Busy</span>
                        </div>
                        <span className="font-bold">{agents.filter(a => a.currentTicketCount > 5).length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-orange-500 rounded-full" />
                          <span className="text-sm">On PTO</span>
                        </div>
                        <span className="font-bold">{ptoData.filter(p => p.start <= new Date() && p.end >= new Date()).length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 bg-gray-500 rounded-full" />
                          <span className="text-sm">Offline</span>
                        </div>
                        <span className="font-bold">{agents.filter(a => !a.isAvailable).length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Coverage Alert</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert className="border-orange-200 bg-orange-50">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <AlertDescription>
                        Low coverage expected on <strong>Friday</strong> with 3 agents on PTO.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Location Settings Tab */}
          <TabsContent value="locations" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Map View */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Geographic Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {locationStats?.locationDistribution && locationStats.locationDistribution.length > 0 ? (
                    <LeafletMap locations={locationStats.locationDistribution} />
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <div className="text-center">
                        <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No location data available</p>
                        <p className="text-sm mt-1">Sync locations to see map</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Pie Chart Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Agent Distribution by Location</CardTitle>
                </CardHeader>
                <CardContent>
                  {locationData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={locationData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {locationData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {locationData.map((location) => (
                      <div key={location.name} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-3 w-3 rounded-full" 
                            style={{ backgroundColor: location.color }}
                          />
                          <span className="text-sm">{location.name}</span>
                        </div>
                        <span className="font-bold">{location.value}</span>
                      </div>
                    ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No location data available</p>
                      <p className="text-sm mt-1">Sync locations to see distribution</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Location Preferences */}
              <Card>
                <CardHeader>
                  <CardTitle>Location Routing Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Same Office Priority</p>
                        <p className="text-xs text-muted-foreground">
                          Prioritize agents in the same office as the ticket requester
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Allow Cross-Location</p>
                        <p className="text-xs text-muted-foreground">
                          Allow assignments across different office locations
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Remote Agent Priority</p>
                        <p className="text-xs text-muted-foreground">
                          Include remote agents in location-based assignments
                        </p>
                      </div>
                      <Switch />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Time Zone Handling</Label>
                    <Select defaultValue="match">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="match">Match agent and ticket time zones</SelectItem>
                        <SelectItem value="ignore">Ignore time zones</SelectItem>
                        <SelectItem value="business">Follow business hours only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Alert>
                    <Globe className="h-4 w-4" />
                    <AlertDescription>
                      Location preferences affect {locationData.length > 0 && agents.length > 0 
                        ? Math.round(locationData[0].value / agents.length * 100)
                        : 0}% of assignments
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>

            {/* Office Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Office Configuration</CardTitle>
                    <CardDescription>
                      Define office locations and their assignment preferences
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setIsSyncingLocations(true)
                        try {
                          await apiService.syncLocations()
                          await refetchLocations()
                          toast.success('Locations synced successfully')
                        } catch (error) {
                          toast.error('Failed to sync locations')
                        } finally {
                          setIsSyncingLocations(false)
                        }
                      }}
                      disabled={isSyncingLocations}
                    >
                      <RefreshCw className={cn('h-4 w-4 mr-2', isSyncingLocations && 'animate-spin')} />
                      Sync Locations
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        setIsSyncingLocations(true)
                        try {
                          const response = await apiService.syncAgents()
                          await refetchLocations()
                          await refetchLocationStats()
                          toast.success(`Synced ${response.data.synced} agents successfully`)
                        } catch (error) {
                          toast.error('Failed to sync agents')
                        } finally {
                          setIsSyncingLocations(false)
                        }
                      }}
                      disabled={isSyncingLocations}
                    >
                      <Users className={cn('h-4 w-4 mr-2', isSyncingLocations && 'animate-spin')} />
                      Sync Agents
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-600"
                      onClick={async () => {
                        if (confirm('This will delete all locations that have no agents assigned. Continue?')) {
                          setIsSyncingLocations(true)
                          try {
                            const response = await apiService.deleteEmptyLocations()
                            await refetchLocations()
                            await refetchLocationStats()
                            toast.success(`Deleted ${response.data.deleted} empty locations: ${response.data.locations.join(', ')}`)
                          } catch (error) {
                            toast.error('Failed to clean up locations')
                          } finally {
                            setIsSyncingLocations(false)
                          }
                        }
                      }}
                      disabled={isSyncingLocations}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clean Empty
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {locations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No locations found. Click "Sync Locations" to import from Freshservice.</p>
                    </div>
                  ) : (
                    locations.map((location) => (
                      <div key={location.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {location.metadata?.isRemote ? (
                            <Home className="h-5 w-5 text-gray-600" />
                          ) : (
                            <Building className="h-5 w-5 text-gray-600" />
                          )}
                          <div>
                            <p className="font-medium">{location.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {locationStats?.byLocation?.[location.name] || 0} agents
                              {location.city && ` • ${location.city}`}
                              {location.country && `, ${location.country}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {location.timezone}
                          </Badge>
                          {location.metadata?.supportTypes?.includes('onsite') && (
                            <Badge variant="secondary">
                              <Briefcase className="h-3 w-3 mr-1" />
                              Onsite
                            </Badge>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setConfigLocation(location)
                              setIsConfigOpen(true)
                            }}
                          >
                            Configure
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={async () => {
                              if (confirm(`Are you sure you want to delete the location "${location.name}"?`)) {
                                try {
                                  await apiService.deleteLocation(location.id)
                                  await refetchLocations()
                                  toast.success('Location deleted successfully')
                                } catch (error: any) {
                                  if (error.response?.data?.message) {
                                    toast.error(error.response.data.message)
                                  } else {
                                    toast.error('Failed to delete location')
                                  }
                                }
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impact Analysis Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Rule Impact Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Rule Impact Analysis</CardTitle>
                  <CardDescription>
                    How many agents are filtered by each rule
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={impactData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="rule" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="passed" stackId="a" fill="#10b981" name="Eligible" />
                      <Bar dataKey="filtered" stackId="a" fill="#ef4444" name="Filtered" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Eligibility Trends */}
              <Card>
                <CardHeader>
                  <CardTitle>Eligibility Trends</CardTitle>
                  <CardDescription>
                    Agent eligibility over the past week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={[
                      { day: 'Mon', eligible: 85, total: 100 },
                      { day: 'Tue', eligible: 82, total: 100 },
                      { day: 'Wed', eligible: 88, total: 100 },
                      { day: 'Thu', eligible: 79, total: 100 },
                      { day: 'Fri', eligible: 75, total: 100 },
                      { day: 'Sat', eligible: 90, total: 100 },
                      { day: 'Sun', eligible: 92, total: 100 }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="eligible" stroke="#10b981" name="Eligible %" />
                      <Line type="monotone" dataKey="total" stroke="#e5e7eb" name="Total" strokeDasharray="5 5" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Eligibility</p>
                      <p className="text-2xl font-bold">84.5%</p>
                    </div>
                    <UserCheck className="h-8 w-8 text-green-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Most Restrictive</p>
                      <p className="text-2xl font-bold">Skills</p>
                    </div>
                    <Filter className="h-8 w-8 text-orange-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Active Rules</p>
                      <p className="text-2xl font-bold">{rules.filter(r => r.enabled).length}/5</p>
                    </div>
                    <Shield className="h-8 w-8 text-blue-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Coverage Score</p>
                      <p className="text-2xl font-bold">Good</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-purple-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Location Configuration Dialog */}
      {configLocation && (
        <LocationConfigDialog
          location={configLocation}
          isOpen={isConfigOpen}
          onClose={() => {
            setIsConfigOpen(false)
            setConfigLocation(null)
          }}
          onUpdate={() => {
            refetchLocations()
            refetchLocationStats()
          }}
        />
      )}
    </MainLayout>
  )
}