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
      id: 'skill_match',
      name: 'Skill Match',
      description: 'Weight for matching agent skills with ticket requirements',
      value: 30,
      icon: Brain,
      color: 'text-purple-600'
    },
    {
      id: 'workload',
      name: 'Workload Balance',
      description: 'Weight for distributing tickets evenly across agents',
      value: 25,
      icon: Users,
      color: 'text-blue-600'
    },
    {
      id: 'level_match',
      name: 'Level Match',
      description: 'Weight for matching agent level (L1/L2/L3) with ticket complexity',
      value: 25,
      icon: Target,
      color: 'text-green-600'
    },
    {
      id: 'location',
      name: 'Location Proximity',
      description: 'Weight for geographic proximity between agent and ticket',
      value: 10,
      icon: MapPin,
      color: 'text-orange-600'
    },
    {
      id: 'vip_affinity',
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
    skills: ['password_reset', 'outlook'],
    level: 'L1',
    location: 'Vancouver',
    isVIP: false
  })

  const [scoringHistory] = useState([
    { date: 'Mon', avgScore: 82, assignments: 45 },
    { date: 'Tue', avgScore: 85, assignments: 52 },
    { date: 'Wed', avgScore: 79, assignments: 48 },
    { date: 'Thu', avgScore: 88, assignments: 61 },
    { date: 'Fri', avgScore: 86, assignments: 55 },
    { date: 'Sat', avgScore: 91, assignments: 32 },
    { date: 'Sun', avgScore: 89, assignments: 28 }
  ])

  const [hasChanges, setHasChanges] = useState(false)
  const [hasTicketAgeChanges, setHasTicketAgeChanges] = useState(false)
  const [loading, setLoading] = useState(false)

  // Load weights on mount
  useEffect(() => {
    loadWeights()
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
        setWeights(prev => [
          { ...prev[0], value: Math.round(data.skillOverlap * 100) },
          { ...prev[1], value: Math.round(data.loadBalance * 100) },
          { ...prev[2], value: Math.round(data.levelCloseness * 100) },
          { ...prev[3], value: Math.round(data.locationFit * 100) },
          { ...prev[4], value: Math.round(data.vipAffinity * 100) }
        ])
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
        // Convert weights to backend format
        const scoringWeights = {
          skillOverlap: weights[0].value / 100,
          loadBalance: weights[1].value / 100,
          levelCloseness: weights[2].value / 100,
          locationFit: weights[3].value / 100,
          vipAffinity: weights[4].value / 100
        }
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
      
      toast.success('Weights saved successfully')
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

  const scoreDistribution = [
    { range: '0-20', count: 5, color: '#ef4444' },
    { range: '21-40', count: 12, color: '#f59e0b' },
    { range: '41-60', count: 28, color: '#eab308' },
    { range: '61-80', count: 45, color: '#84cc16' },
    { range: '81-100', count: 65, color: '#10b981' }
  ]

  const radarData = weights.map(w => ({
    subject: w.name,
    value: w.value,
    fullMark: 50
  }))

  const calculateExampleScore = () => {
    let score = 0
    if (testScenario.skills.length > 0) score += weights[0].value * 0.8
    score += weights[1].value * 0.7
    if (testScenario.level === 'L1') score += weights[2].value * 0.9
    if (testScenario.location === 'Vancouver') score += weights[3].value * 1.0
    if (testScenario.isVIP) score += weights[4].value * 0.5
    return Math.min(Math.round(score), 100)
  }

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
            <TabsTrigger value="history">
              <History className="h-4 w-4 mr-2" />
              Scoring History
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
                    <div className="flex flex-wrap gap-2">
                      {['password_reset', 'outlook', 'vpn', 'hardware'].map(skill => (
                        <Badge
                          key={skill}
                          variant={testScenario.skills.includes(skill) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            setTestScenario(prev => ({
                              ...prev,
                              skills: prev.skills.includes(skill)
                                ? prev.skills.filter(s => s !== skill)
                                : [...prev.skills, skill]
                            }))
                          }}
                        >
                          {skill}
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
                    <Label>Location</Label>
                    <Select
                      value={testScenario.location}
                      onValueChange={(value) => setTestScenario(prev => ({ ...prev, location: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vancouver">Vancouver</SelectItem>
                        <SelectItem value="Toronto">Toronto</SelectItem>
                        <SelectItem value="Remote">Remote</SelectItem>
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

                  <Button className="w-full" size="sm">
                    <Play className="h-4 w-4 mr-2" />
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Simulation Results</CardTitle>
                  <CardDescription>
                    Score breakdown for the test scenario
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center py-4">
                      <div className="text-5xl font-bold text-blue-600">
                        {calculateExampleScore()}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
                    </div>

                    <div className="space-y-3">
                      {weights.map((weight) => {
                        const factorScore = 
                          weight.id === 'skill_match' ? (testScenario.skills.length > 0 ? 80 : 0) :
                          weight.id === 'workload' ? 70 :
                          weight.id === 'level_match' ? (testScenario.level === 'L1' ? 90 : 60) :
                          weight.id === 'location' ? (testScenario.location === 'Vancouver' ? 100 : 50) :
                          weight.id === 'vip_affinity' ? (testScenario.isVIP ? 50 : 0) : 0
                        
                        const contribution = (weight.value * factorScore) / 100
                        const WeightIcon = weight.icon

                        return (
                          <div key={weight.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <WeightIcon className={`h-3 w-3 ${weight.color}`} />
                                <span>{weight.name}</span>
                              </div>
                              <span className="font-medium">+{contribution.toFixed(1)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${factorScore}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <Alert>
                      <Zap className="h-4 w-4" />
                      <AlertDescription>
                        Score of {calculateExampleScore()} indicates a 
                        <span className="font-medium text-green-600"> strong match</span>.
                        This ticket would likely be auto-assigned.
                      </AlertDescription>
                    </Alert>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Score Distribution</CardTitle>
                  <CardDescription>
                    Distribution of assignment scores over the past week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={scoreDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count">
                        {scoreDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={scoringHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[70, 100]} />
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
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Score</p>
                      <p className="text-2xl font-bold">85.7%</p>
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
                      <p className="text-2xl font-bold">65%</p>
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
                      <p className="text-2xl font-bold">8%</p>
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
                      <p className="text-2xl font-bold">78%</p>
                    </div>
                    <Zap className="h-8 w-8 text-purple-600 opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Scoring Decisions</CardTitle>
                <CardDescription>
                  View and analyze past scoring calculations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {85 + i}
                          </div>
                          <p className="text-xs text-muted-foreground">Score</p>
                        </div>
                        <div>
                          <p className="font-medium">Ticket #{1000 + i}</p>
                          <p className="text-sm text-muted-foreground">
                            Assigned to Agent {100 + i} • {i} hours ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Auto-assigned</Badge>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}