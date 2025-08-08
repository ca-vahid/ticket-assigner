'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAgents } from '@/hooks/useAgents'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts'
import { Clock } from 'lucide-react'

export function TicketAgeDistribution() {
  const { agents, loading } = useAgents()
  
  // Calculate total ticket distribution across all agents
  const calculateDistribution = () => {
    let totalFresh = 0
    let totalRecent = 0
    let totalStale = 0
    let totalAbandoned = 0
    
    agents.forEach(agent => {
      if (agent.ticketWorkloadBreakdown) {
        totalFresh += agent.ticketWorkloadBreakdown.fresh || 0
        totalRecent += agent.ticketWorkloadBreakdown.recent || 0
        totalStale += agent.ticketWorkloadBreakdown.stale || 0
        totalAbandoned += agent.ticketWorkloadBreakdown.abandoned || 0
      }
    })
    
    return {
      fresh: totalFresh,
      recent: totalRecent,
      stale: totalStale,
      abandoned: totalAbandoned,
      total: totalFresh + totalRecent + totalStale + totalAbandoned
    }
  }
  
  const distribution = calculateDistribution()
  
  const barData = [
    { 
      name: 'Fresh',
      category: '0-1 days',
      value: distribution.fresh,
      color: '#dc2626',
      weight: 2.0
    },
    { 
      name: 'Recent',
      category: '2-5 days',
      value: distribution.recent,
      color: '#ea580c',
      weight: 1.2
    },
    { 
      name: 'Stale',
      category: '6-14 days',
      value: distribution.stale,
      color: '#ca8a04',
      weight: 0.5
    },
    { 
      name: 'Abandoned',
      category: '15+ days',
      value: distribution.abandoned,
      color: '#6b7280',
      weight: 0.1
    }
  ]
  
  const pieData = barData.filter(d => d.value > 0).map(d => ({
    name: d.name,
    value: d.value,
    percentage: ((d.value / distribution.total) * 100).toFixed(1),
    color: d.color
  }))
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Age Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 animate-pulse bg-gray-100 rounded"></div>
        </CardContent>
      </Card>
    )
  }
  
  if (distribution.total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Age Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mr-2" />
            <span>No active tickets</span>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Ticket Age Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Bar Chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Ticket Count by Age</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload[0]) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-white p-3 shadow-lg rounded border">
                          <p className="font-semibold">{data.name}</p>
                          <p className="text-sm text-gray-600">{data.category}</p>
                          <p className="text-sm">Count: {data.value}</p>
                          <p className="text-sm text-orange-600">Weight: {data.weight}x</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Bar dataKey="value">
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            {barData.map((item) => (
              <div key={item.name} className="text-center">
                <div 
                  className="text-2xl font-bold"
                  style={{ color: item.color }}
                >
                  {item.value}
                </div>
                <div className="text-xs text-gray-600">{item.name}</div>
                <div className="text-xs text-gray-500">Weight: {item.weight}x</div>
              </div>
            ))}
          </div>
          
          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              <strong>Smart Workload Balancing:</strong> Fresh tickets (0-1 days) count as 2x weight, 
              preventing agents from hoarding old tickets to avoid new assignments.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}