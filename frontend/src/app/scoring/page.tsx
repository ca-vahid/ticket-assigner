'use client'

import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Calculator,
  Save,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  Info,
  Brain,
  Target,
  Users,
  MapPin,
  Star,
  AlertCircle,
  BarChart3,
  Activity,
  Zap,
  Settings,
  Play,
  History,
  FlaskConical,
  Clock
} from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'
import { SyncProgressBar } from '@/components/SyncProgressBar'
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend
} from 'recharts'

interface ScoringWeight {
  id: string
  name: string
  description: string
  value: number
  icon: any
  color: string
}

interface TicketAgeWeight {
  id: string
  name: string
  description: string
  value: number
  color: string
}

export default function ScoringPage() {
  const [weights, setWeights] = useState<ScoringWeight[]>([
    {
      id: 'skillOverlap',
      name: 'Skill Match',
      description: 'Weight for matching agent skills with ticket requirements',
      value: 30,
      icon: Brain,
      color: 'text-purple-600'
    },
    {
      id: 'loadBalance',
      name: 'Workload Balance',
      description: 'Weight for distributing tickets evenly across agents',
      value: 25,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      id: 'levelCloseness',
      name: 'Level Match',
      description: 'Weight for matching agent level (L1/L2/L3) with ticket complexity',
      value: 25,
      icon: Target,
      color: 'text-green-600'
    },
    {
      id: 'locationFit',
      name: 'Location Proximity',
      description: 'Weight for geographic proximity between agent and ticket',
      value: 10,
      icon: MapPin,
      color: 'text-orange-600'
    },
    {
      id: 'vipAffinity',
      name: 'VIP Affinity',
      description: 'Weight for assigning VIP tickets to specialized agents',
      value: 10,
      icon: Star,
      color: 'text-yellow-600'
    }
  ])

  const [ticketAgeWeights, setTicketAgeWeights] = useState<TicketAgeWeight[]>([
    {
      id: 'fresh',
      name: 'Fresh (0-1 days)',
      description: 'Weight multiplier for very new tickets',
      value: 2.0,
      color: 'text-green-600'
    },
    {
      id: 'recent',
      name: 'Recent (2-5 days)',
      description: 'Weight multiplier for recent tickets',
      value: 1.2,
      color: 'text-blue-600'
    },
    {
      id: 'stale',
      name: 'Stale (6-14 days)',
      description: 'Weight multiplier for older tickets',
      value: 0.5,
      color: 'text-orange-600'
    },
    {
      id: 'old',
      name: 'Old (15+ days)',
      description: 'Weight multiplier for very old tickets',
      value: 0.1,
      color: 'text-red-600'
    }
  ])

  const [testScenario, setTestScenario] = useState({
    skills: [],
    level: 'L1',
    locationId: undefined as string | undefined,
    isVIP: false
  })
  
  const [availableSkills, setAvailableSkills] = useState<string[]>([])
  const [availableLocations, setAvailableLocations] = useState<{ id: string; name: string; timezone?: string }[]>([])
  const [testResults, setTestResults] = useState<any>(null)
  const [testingScenario, setTestingScenario] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<{
    scoreDistribution: { range: string; count: number; color: string }[];
    scoringHistory: { date: string; avgScore: number; assignments: number }[];
    metrics: {
      avgScore: number;
      highScorePercentage: number;
      lowScorePercentage: number;
      autoAssignRate: number;
      totalAssignments: number;
    };
  } | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  const [hasChanges, setHasChanges] = useState(false)
  const [hasTicketAgeChanges, setHasTicketAgeChanges] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load weights and available data on mount
  useEffect(() => {
    loadWeights()
    loadAvailableData()
    loadAnalyticsData()
  }, [])

  const loadWeights = async () => {
    setLoading(true)
    try {
      // Load scoring weights
      const [scoringResponse, ticketAgeResponse] = await Promise.all([
        apiService.getScoringWeights(),
        apiService.getTicketAgeWeights()
      ])
      
      if (scoringResponse.data) {
        const data = scoringResponse.data
        setWeights(prev => prev.map(w => {
          switch(w.id) {
            case 'skillOverlap': return { ...w, value: Math.round(data.skillOverlap * 100) }
            case 'loadBalance': return { ...w, value: Math.round(data.loadBalance * 100) }
            case 'levelCloseness': return { ...w, value: Math.round(data.levelCloseness * 100) }
            case 'locationFit': return { ...w, value: Math.round(data.locationFit * 100) }
            case 'vipAffinity': return { ...w, value: Math.round(data.vipAffinity * 100) }
            default: return w
          }
        }))
      }
      
      if (ticketAgeResponse.data) {
        const data = ticketAgeResponse.data
        setTicketAgeWeights(prev => [
          { ...prev[0], value: data.fresh },
          { ...prev[1], value: data.recent },
          { ...prev[2], value: data.stale },
          { ...prev[3], value: data.old }
        ])
      }
    } catch (error) {
      console.error('Failed to load weights:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const loadAvailableData = async () => {
    try {
      const [skillsResponse, locationsResponse] = await Promise.all([
        apiService.getAvailableSkills(),
        apiService.getAvailableLocations()
      ])
      
      if (skillsResponse.data) {
        setAvailableSkills(skillsResponse.data)
      }
      
      if (locationsResponse.data) {
        setAvailableLocations(locationsResponse.data)
      }
    } catch (error) {
      console.error('Failed to load available data:', error)
    }
  }
  
  const loadAnalyticsData = async () => {
    setLoadingAnalytics(true)
    try {
      const response = await apiService.getScoringAnalytics()
      if (response.data) {
        setAnalyticsData(response.data)
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error)
    } finally {
      setLoadingAnalytics(false)
    }
  }
  
  const runTestScenario = async () => {
    setTestingScenario(true)
    try {
      // Use the centralized assignment test endpoint that includes eligibility + scoring
      const response = await apiService.testAssignmentScenario(testScenario)
      setTestResults(response.data)
    } catch (error) {
      console.error('Failed to run test scenario:', error)
      toast.error('Failed to run test scenario')
    } finally {
      setTestingScenario(false)
    }
  }

  const handleWeightChange = (id: string, value: number[]) => {
    setWeights(prev => prev.map(w => 
      w.id === id ? { ...w, value: value[0] } : w
    ))
    setHasChanges(true)
  }

  const handleTicketAgeWeightChange = (id: string, value: number[]) => {
    setTicketAgeWeights(prev => prev.map(w => 
      w.id === id ? { ...w, value: value[0] } : w
    ))
    setHasTicketAgeChanges(true)
  }

  const normalizeWeights = () => {
    const total = weights.reduce((sum, w) => sum + w.value, 0)
    if (total === 100) return
    
    setWeights(prev => prev.map(w => ({
      ...w,
      value: Math.round((w.value / total) * 100)
    })))
  }

  const resetWeights = () => {
    setWeights(prev => [
      { ...prev[0], value: 30 },
      { ...prev[1], value: 25 },
      { ...prev[2], value: 25 },
      { ...prev[3], value: 10 },
      { ...prev[4], value: 10 }
    ])
    setTicketAgeWeights(prev => [
      { ...prev[0], value: 2.0 },
      { ...prev[1], value: 1.2 },
      { ...prev[2], value: 0.5 },
      { ...prev[3], value: 0.1 }
    ])
    setHasChanges(false)
    setHasTicketAgeChanges(false)
  }

  const saveWeights = async () => {
    setLoading(true)
    try {
      const promises = []
      
      if (hasChanges) {
        // Convert weights to backend format using IDs
        const scoringWeights = weights.reduce((acc, w) => {
          acc[w.id] = w.value / 100
          return acc
        }, {} as any)
        promises.push(apiService.updateScoringWeights(scoringWeights))
      }
      
      if (hasTicketAgeChanges) {
        const ticketWeights = {
          fresh: ticketAgeWeights[0].value,
          recent: ticketAgeWeights[1].value,
          stale: ticketAgeWeights[2].value,
          old: ticketAgeWeights[3].value
        }
        promises.push(apiService.updateTicketAgeWeights(ticketWeights))
      }
      
      await Promise.all(promises)
      
      // If ticket age weights were changed, recalculate workloads
      if (hasTicketAgeChanges) {
        toast.info('Recalculating agent workloads...')
        try {
          const result = await apiService.recalculateWorkloads()
          if (result.data.success) {
            toast.success(`Weights saved and workloads updated for ${result.data.updated} agents`)
          }
        } catch (error) {
          console.error('Failed to recalculate workloads:', error)
          toast.warning('Weights saved but workload recalculation failed. Please sync tickets manually.')
        }
      } else {
        toast.success('Weights saved successfully')
      }
      
      setHasChanges(false)
      setHasTicketAgeChanges(false)
    } catch (error) {
      console.error('Failed to save weights:', error)
      toast.error('Failed to save weights')
    } finally {
      setLoading(false)
    }
  }

  const totalWeight = weights.reduce((sum, w) => sum + w.value, 0)

  const radarData = weights.map(w => ({
    subject: w.name,
    value: w.value,
    fullMark: 50
  }))


  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Scoring Configuration</h2>
            <p className="text-muted-foreground">
              Configure and test the ticket assignment scoring algorithm
            </p>
          </div>
          <div className="flex gap-2">
            {(hasChanges || hasTicketAgeChanges) && (
              <Badge variant="outline" className="bg-yellow-50">
                <AlertCircle className="h-3 w-3 mr-1" />
                Unsaved changes
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={resetWeights} disabled={loading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={saveWeights} disabled={!hasChanges && !hasTicketAgeChanges || loading}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="weights" className="space-y-4">
          <TabsList>
            <TabsTrigger value="weights">
              <Settings className="h-4 w-4 mr-2" />
              Weight Configuration
            </TabsTrigger>
            <TabsTrigger value="simulator">
              <FlaskConical className="h-4 w-4 mr-2" />
              Test Simulator
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weights" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Scoring Weights</CardTitle>
                  <CardDescription>
                    Adjust the importance of each factor in the scoring algorithm
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {weights.map((weight) => {
                    const WeightIcon = weight.icon
                    return (
                      <div key={weight.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <WeightIcon className={`h-4 w-4 ${weight.color}`} />
                            <Label>{weight.name}</Label>
                          </div>
                          <span className="text-sm font-bold">{weight.value}%</span>
                        </div>
                        <Slider
                          value={[weight.value]}
                          onValueChange={(value) => handleWeightChange(weight.id, value)}
                          max={50}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-muted-foreground">{weight.description}</p>
                      </div>
                    )
                  })}
                  
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Weight</span>
                      <Badge variant={totalWeight === 100 ? 'default' : 'destructive'}>
                        {totalWeight}%
                      </Badge>
                    </div>
                    {totalWeight !== 100 && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Weights should sum to 100%. 
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="px-1"
                            onClick={normalizeWeights}
                          >
                            Auto-normalize
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Weight Distribution</CardTitle>
                  <CardDescription>
                    Visual representation of scoring weights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" className="text-xs" />
                      <PolarRadiusAxis angle={90} domain={[0, 50]} />
                      <Radar
                        name="Weight"
                        dataKey="value"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.6}
                      />
                    </RadarChart>
                  </ResponsiveContainer>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {weights.map((weight) => (
                      <div key={weight.id} className="flex items-center gap-2 text-sm">
                        <div 
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: '#3b82f6', opacity: weight.value / 50 }}
                        />
                        <span className="text-muted-foreground">{weight.name}:</span>
                        <span className="font-medium">{weight.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ticket Age Weights Section */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-600" />
                    Ticket Age Weights
                  </CardTitle>
                  <CardDescription>
                    Adjust how ticket age affects workload calculation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {ticketAgeWeights.map((weight) => (
                    <div key={weight.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${weight.color}`} />
                          <Label>{weight.name}</Label>
                        </div>
                        <span className="text-sm font-bold">×{weight.value.toFixed(1)}</span>
                      </div>
                      <Slider
                        value={[weight.value]}
                        onValueChange={(value) => handleTicketAgeWeightChange(weight.id, value)}
                        max={3}
                        min={0.1}
                        step={0.1}
                        className="w-full"
                      />
                      <p className="text-xs text-muted-foreground">{weight.description}</p>
                    </div>
                  ))}
                  
                  <Alert className="mt-4">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      These weights multiply the ticket count when calculating agent workload.
                      Higher values mean tickets in that age range count more toward workload.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Workload Impact Example</CardTitle>
                  <CardDescription>
                    How ticket age affects workload calculation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground mb-4">
                      Agent with 10 tickets of varying ages:
                    </div>
                    {ticketAgeWeights.map((weight) => {
                      const exampleCount = weight.id === 'fresh' ? 2 : 
                                          weight.id === 'recent' ? 3 :
                                          weight.id === 'stale' ? 3 : 2;
                      const weightedCount = exampleCount * weight.value;
                      
                      return (
                        <div key={weight.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className={weight.color}>{weight.name}</span>
                            <span className="text-muted-foreground">
                              {exampleCount} tickets × {weight.value.toFixed(1)} = 
                              <span className="font-medium ml-1">{weightedCount.toFixed(1)}</span>
                            </span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full transition-all"
                              style={{ 
                                width: `${(weightedCount / 6) * 100}%`,
                                backgroundColor: weight.color.replace('text-', '').replace('-600', '')
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                    
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Total Weighted Workload</span>
                        <span className="text-lg font-bold text-blue-600">
                          {ticketAgeWeights.reduce((sum, w, i) => {
                            const counts = [2, 3, 3, 2];
                            return sum + (counts[i] * w.value);
                          }, 0).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        vs. 10.0 for unweighted count
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  How Scoring Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {weights.map((weight) => {
                      const WeightIcon = weight.icon
                      return (
                        <div key={weight.id} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <WeightIcon className={`h-4 w-4 ${weight.color}`} />
                            <span className="font-medium">{weight.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {weight.id === 'skill_match' && 'Calculates overlap between agent skills and ticket requirements'}
                            {weight.id === 'workload' && 'Prefers agents with fewer active tickets'}
                            {weight.id === 'level_match' && 'Matches ticket complexity with agent expertise level'}
                            {weight.id === 'location' && 'Prioritizes agents in the same location as the ticket'}
                            {weight.id === 'vip_affinity' && 'Routes VIP tickets to specialized senior agents'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  
                  <Alert>
                    <Calculator className="h-4 w-4" />
                    <AlertDescription>
                      Final Score = Σ(Weight × Factor Score) / 100
                      <br />
                      Scores range from 0-100, with higher scores indicating better matches.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulator" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Test Scenario</CardTitle>
                  <CardDescription>
                    Configure a hypothetical ticket to test scoring
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Required Skills</Label>
                    <Select
                      value=""
                      onValueChange={(skill) => {
                        if (!testScenario.skills.includes(skill)) {
                          setTestScenario(prev => ({
                            ...prev,
                            skills: [...prev.skills, skill]
                          }))
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select skills..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSkills.filter(s => !testScenario.skills.includes(s)).map(skill => (
                          <SelectItem key={skill} value={skill}>
                            {skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {testScenario.skills.map(skill => (
                        <Badge
                          key={skill}
                          variant="default"
                          className="cursor-pointer"
                          onClick={() => {
                            setTestScenario(prev => ({
                              ...prev,
                              skills: prev.skills.filter(s => s !== skill)
                            }))
                          }}
                        >
                          {skill.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          <span className="ml-1 text-xs">×</span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ticket Level</Label>
                    <Select
                      value={testScenario.level}
                      onValueChange={(value) => setTestScenario(prev => ({ ...prev, level: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L1">Level 1 (Basic)</SelectItem>
                        <SelectItem value="L2">Level 2 (Intermediate)</SelectItem>
                        <SelectItem value="L3">Level 3 (Advanced)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Location (Optional)</Label>
                    <Select
                      value={testScenario.locationId || ''}
                      onValueChange={(value) => setTestScenario(prev => ({ 
                        ...prev, 
                        locationId: value === 'none' ? undefined : value 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No location requirement" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No location requirement</SelectItem>
                        {availableLocations.map(location => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name} {location.timezone && `(${location.timezone})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>VIP Ticket</Label>
                    <Button
                      variant={testScenario.isVIP ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTestScenario(prev => ({ ...prev, isVIP: !prev.isVIP }))}
                    >
                      {testScenario.isVIP ? 'Yes' : 'No'}
                    </Button>
                  </div>

                  <Button 
                    className="w-full" 
                    size="sm"
                    onClick={runTestScenario}
                    disabled={testingScenario || testScenario.skills.length === 0}
                  >
                    {testingScenario ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Simulation
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Simulation Results</CardTitle>
                  <CardDescription>
                    {testResults ? 'Live scoring results from actual agent data' : 'Run a simulation to see results'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {testResults ? (
                    <div className="space-y-4">
                      {/* Statistics */}
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <div className="text-xl font-bold text-gray-600">
                            {testResults.statistics?.totalAgents || 0}
                          </div>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-blue-600">
                            {testResults.statistics?.eligibleAgents || testResults.eligibleAgents?.length || 0}
                          </div>
                          <p className="text-xs text-muted-foreground">Eligible</p>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-green-600">
                            {testResults.statistics?.qualifiedAgents || testResults.topRecommendations?.length || 0}
                          </div>
                          <p className="text-xs text-muted-foreground">Qualified</p>
                        </div>
                        <div>
                          <div className="text-xl font-bold text-purple-600">
                            {(testResults.statistics?.averageScore * 100 || 0).toFixed(0)}
                          </div>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                      </div>

                      {/* Eligibility Filters Applied */}
                      {testResults.filters && (
                        <Alert className="py-2">
                          <Info className="h-3 w-3" />
                          <AlertDescription className="text-xs">
                            <strong>Filters Applied:</strong> Available agents • 
                            {testResults.filters.checkPTO && ' No PTO •'}
                            {testResults.filters.maxLoadPercentage && ` < ${(testResults.filters.maxLoadPercentage * 100).toFixed(0)}% load •`}
                            {testResults.filters.minLevel && ` Level ≥ ${testResults.filters.minLevel} •`}
                            {testResults.filters.requiresOnsite && ' Onsite capable'}
                            {testResults.statistics?.minScoreThreshold && (
                              <span className="block mt-1">
                                <strong>Min Score Threshold:</strong> {(testResults.statistics.minScoreThreshold * 100).toFixed(0)}% • 
                                {testResults.statistics.agentsMeetingThreshold || 0} agents qualify
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Scoring Algorithm Breakdown */}
                      <Alert className="py-2 bg-blue-50 border-blue-200">
                        <Info className="h-3 w-3" />
                        <AlertDescription className="text-xs">
                          <strong>Total Score Calculation:</strong>
                          <div className="mt-1 space-y-1">
                            <div className="flex justify-between">
                              <span>• <strong>Skill Match ({(weights.find(w => w.id === 'skillOverlap')?.value || 30)}%):</strong> How many required skills agent has</span>
                              <span className="text-xs text-gray-600">1.0 = all skills, 0.5 = half skills</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• <strong>Level Match ({(weights.find(w => w.id === 'levelCloseness')?.value || 25)}%):</strong> How close agent level is to requirement</span>
                              <span className="text-xs text-gray-600">1.0 = exact, 0.8 = ±1 level, 0.5 = ±2 levels</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• <strong>Load Balance ({(weights.find(w => w.id === 'loadBalance')?.value || 25)}%):</strong> Lower workload = higher score</span>
                              <span className="text-xs text-gray-600">Linear: score = 1 - (weighted tickets / max)</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• <strong>Location ({(weights.find(w => w.id === 'locationFit')?.value || 10)}%):</strong> Same location or timezone match</span>
                              <span className="text-xs text-gray-600">1.0 = same/no requirement, 0.9 = different</span>
                            </div>
                            <div className="flex justify-between">
                              <span>• <strong>VIP ({(weights.find(w => w.id === 'vipAffinity')?.value || 10)}%):</strong> Agent experience for VIP tickets</span>
                              <span className="text-xs text-gray-600">Based on satisfaction score & experience</span>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t">
                            <strong>Workload Details:</strong> We use <strong>weighted workload</strong> where fresh tickets (today) count 2x, 
                            recent (2-5 days) count 1.2x to prevent gaming.
                            <div className="mt-1 grid grid-cols-4 gap-2 text-xs">
                              <span>🟢 0-30%: Score 80-100</span>
                              <span>🟡 30-70%: Score 40-80</span>
                              <span>🟠 70-85%: Score 20-40</span>
                              <span>🔴 85%+: Score 0-20</span>
                            </div>
                          </div>
                        </AlertDescription>
                      </Alert>

                      {/* All Agent Scores */}
                      {testResults.topRecommendations && testResults.topRecommendations.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            All Agents Ranked by Score ({testResults.topRecommendations.length} agents)
                            {testResults.topRecommendations[0]?.wouldAutoAssign && (
                              <Badge variant="default" className="text-xs">Would Auto-Assign #1</Badge>
                            )}
                          </h4>
                          {testResults.topRecommendations.map((rec: any) => (
                            <div key={rec.agentId} className={`p-3 border rounded-lg space-y-2 ${!rec.meetsMinThreshold ? 'opacity-60 bg-gray-50' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">#{rec.rank}. {rec.agentName}</span>
                                  <Badge variant="outline" className="ml-2">{rec.level}</Badge>
                                  {!rec.meetsMinThreshold && (
                                    <Badge variant="secondary" className="ml-2 text-xs">Below Threshold</Badge>
                                  )}
                                  {rec.confidence && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      ({(rec.confidence * 100).toFixed(0)}% confidence)
                                    </span>
                                  )}
                                </div>
                                <div className={`text-2xl font-bold ${rec.meetsMinThreshold ? 'text-blue-600' : 'text-gray-400'}`}>
                                  {(rec.totalScore * 100).toFixed(0)}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">
                                  {rec.location} • 
                                  <span className={`font-medium ${rec.currentWorkload === 0 ? 'text-green-600' : rec.currentWorkload >= 4 ? 'text-red-600' : 'text-yellow-600'}`}>
                                    {rec.currentWorkload || 0}/{rec.maxConcurrentTickets || 5} tickets
                                  </span>
                                  {' '}(weighted: {Number(rec.weightedWorkload || 0).toFixed(1)})
                                </div>
                                {/* Workload visual bar */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-16">Workload:</span>
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 relative">
                                    <div 
                                      className={`h-2 rounded-full transition-all ${
                                        (rec.currentWorkload / (rec.maxConcurrentTickets || 5)) >= 0.8 ? 'bg-red-500' :
                                        (rec.currentWorkload / (rec.maxConcurrentTickets || 5)) >= 0.5 ? 'bg-yellow-500' :
                                        'bg-green-500'
                                      }`}
                                      style={{ width: `${Math.min(100, (rec.currentWorkload / (rec.maxConcurrentTickets || 5)) * 100)}%` }}
                                      title={`Current: ${rec.currentWorkload} tickets, Weighted: ${Number(rec.weightedWorkload || 0).toFixed(1)} (fresher tickets count more)`}
                                    />
                                  </div>
                                  <span className="text-xs font-medium w-12">
                                    {((rec.currentWorkload / (rec.maxConcurrentTickets || 5)) * 100).toFixed(0)}%
                                  </span>
                                  <Badge variant="outline" className="text-xs px-1 py-0">
                                    Score: {(rec.breakdown.loadScore * 100).toFixed(0)}
                                  </Badge>
                                </div>
                              </div>
                              {rec.assignmentReason && (
                                <div className="text-xs bg-blue-50 p-2 rounded">
                                  <strong>Reason:</strong> {rec.assignmentReason}
                                </div>
                              )}
                              {/* Score Breakdown with Weights */}
                              <div className="space-y-1 p-2 bg-gray-50 rounded text-xs">
                                <div className="font-semibold mb-1">Score Breakdown:</div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Skill ({weights.find(w => w.id === 'skillOverlap')?.value || 30}%):</span>
                                    <span className="font-medium">{(rec.breakdown.skillScore * 100).toFixed(0)} → {(rec.breakdown.skillScore * (weights.find(w => w.id === 'skillOverlap')?.value || 30)).toFixed(1)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Level ({weights.find(w => w.id === 'levelCloseness')?.value || 25}%):</span>
                                    <span className="font-medium">{(rec.breakdown.levelScore * 100).toFixed(0)} → {(rec.breakdown.levelScore * (weights.find(w => w.id === 'levelCloseness')?.value || 25)).toFixed(1)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Load ({weights.find(w => w.id === 'loadBalance')?.value || 25}%):</span>
                                    <span className="font-medium">{(rec.breakdown.loadScore * 100).toFixed(0)} → {(rec.breakdown.loadScore * (weights.find(w => w.id === 'loadBalance')?.value || 25)).toFixed(1)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">Location ({weights.find(w => w.id === 'locationFit')?.value || 10}%):</span>
                                    <span className="font-medium">{(rec.breakdown.locationScore * 100).toFixed(0)} → {(rec.breakdown.locationScore * (weights.find(w => w.id === 'locationFit')?.value || 10)).toFixed(1)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">VIP ({weights.find(w => w.id === 'vipAffinity')?.value || 10}%):</span>
                                    <span className="font-medium">{(rec.breakdown.vipScore * 100).toFixed(0)} → {(rec.breakdown.vipScore * (weights.find(w => w.id === 'vipAffinity')?.value || 10)).toFixed(1)}</span>
                                  </div>
                                </div>
                                <div className="pt-1 mt-1 border-t font-semibold flex justify-between">
                                  <span>Total Score:</span>
                                  <span>{(rec.totalScore * 100).toFixed(0)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            {testResults.statistics?.eligibleAgents === 0 
                              ? 'No eligible agents found. Check eligibility filters above.'
                              : `No agents met the minimum score threshold (${(testResults.statistics?.minScoreThreshold * 100 || 50).toFixed(0)}%).`}
                            {testResults.statistics?.excludedReasons && Object.keys(testResults.statistics.excludedReasons).length > 0 && (
                              <div className="mt-2 text-xs">
                                <strong>Excluded:</strong>
                                {Object.entries(testResults.statistics.excludedReasons).map(([reason, count]: [string, any]) => (
                                  <span key={reason}> {reason}: {count} agents •</span>
                                ))}
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Score Distribution */}
                      {testResults.statistics?.scoreDistribution && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">Score Distribution</h4>
                          <div className="space-y-1">
                            {testResults.statistics.scoreDistribution.map((range: any) => (
                              <div key={range.range} className="flex items-center gap-2 text-xs">
                                <span className="w-12 text-muted-foreground">{range.range}</span>
                                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500"
                                    style={{ width: `${testResults.statistics.scoredAgents > 0 ? (range.count / testResults.statistics.scoredAgents) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right">{range.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FlaskConical className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>Configure a test scenario and click "Run Simulation"</p>
                      <p className="text-xs mt-1">Results will show real agent scores</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {loadingAnalytics ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading analytics data...</p>
                </div>
              </div>
            ) : analyticsData ? (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Score Distribution</CardTitle>
                      <CardDescription>
                        Distribution of assignment scores over the past 7 days
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {analyticsData.metrics.totalAssignments > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.scoreDistribution}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count">
                              {analyticsData.scoreDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                          <div className="text-center">
                            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No assignment data available</p>
                            <p className="text-xs mt-1">Scores will appear here once assignments are made</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Average Score Trend</CardTitle>
                      <CardDescription>
                        Daily average assignment scores
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {analyticsData.metrics.totalAssignments > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={analyticsData.scoringHistory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="avgScore"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ fill: '#3b82f6' }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                          <div className="text-center">
                            <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No trend data available</p>
                            <p className="text-xs mt-1">Trends will appear after assignments are made</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Avg Score</p>
                          <p className="text-2xl font-bold">
                            {analyticsData.metrics.avgScore}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {analyticsData.metrics.totalAssignments} total
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">High Scores (&gt;80)</p>
                          <p className="text-2xl font-bold">
                            {analyticsData.metrics.highScorePercentage}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            of assignments
                          </p>
                        </div>
                        <Target className="h-8 w-8 text-blue-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Low Scores (&lt;40)</p>
                          <p className="text-2xl font-bold">
                            {analyticsData.metrics.lowScorePercentage}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            need review
                          </p>
                        </div>
                        <AlertCircle className="h-8 w-8 text-orange-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Auto-Assign Rate</p>
                          <p className="text-2xl font-bold">
                            {analyticsData.metrics.autoAssignRate}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            automated
                          </p>
                        </div>
                        <Zap className="h-8 w-8 text-purple-600 opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Refresh button */}
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAnalyticsData}
                    disabled={loadingAnalytics}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Analytics
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                  <p className="text-muted-foreground">Failed to load analytics data</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAnalyticsData}
                    className="mt-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
      
      {/* Real-time Sync Progress */}
      <SyncProgressBar />
    </MainLayout>
  )
}