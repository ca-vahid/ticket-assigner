'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const data = [
  { date: 'Mon', accuracy: 92, autoAssign: 85 },
  { date: 'Tue', accuracy: 94, autoAssign: 87 },
  { date: 'Wed', accuracy: 91, autoAssign: 83 },
  { date: 'Thu', accuracy: 95, autoAssign: 89 },
  { date: 'Fri', accuracy: 93, autoAssign: 86 },
  { date: 'Sat', accuracy: 96, autoAssign: 91 },
  { date: 'Sun', accuracy: 94, autoAssign: 88 },
]

export function AssignmentAccuracy() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assignment Accuracy Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: '#888' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: '#888' }}
              domain={[80, 100]}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '6px'
              }}
            />
            <Line
              type="monotone"
              dataKey="accuracy"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Suggestion Accuracy"
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="autoAssign"
              stroke="#10b981"
              strokeWidth={2}
              name="Auto-Assignment Rate"
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}