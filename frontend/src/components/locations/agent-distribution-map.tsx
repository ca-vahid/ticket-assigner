'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Users } from 'lucide-react'

// Canadian city coordinates
const cityCoordinates: Record<string, { lat: number; lng: number; province: string }> = {
  'Calgary': { lat: 51.0447, lng: -114.0719, province: 'AB' },
  'Edmonton': { lat: 53.5461, lng: -113.4938, province: 'AB' },
  'Vancouver': { lat: 49.2827, lng: -123.1207, province: 'BC' },
  'Victoria': { lat: 48.4284, lng: -123.3656, province: 'BC' },
  'Kamloops': { lat: 50.6745, lng: -120.3273, province: 'BC' },
  'Surrey': { lat: 49.1913, lng: -122.8490, province: 'BC' },
  'Toronto': { lat: 43.6532, lng: -79.3832, province: 'ON' },
  'Ottawa': { lat: 45.4215, lng: -75.6972, province: 'ON' },
  'Montreal': { lat: 45.5017, lng: -73.5673, province: 'QC' },
  'Winnipeg': { lat: 49.8951, lng: -97.1384, province: 'MB' },
  'Halifax': { lat: 44.6488, lng: -63.5752, province: 'NS' },
  'Fredericton': { lat: 45.9636, lng: -66.6431, province: 'NB' },
  'Santiago': { lat: -33.4489, lng: -70.6693, province: 'Chile' },
  'Colorado': { lat: 39.5501, lng: -105.7821, province: 'USA' }
}

interface LocationData {
  id: string
  name: string
  city?: string
  country?: string
  agentCount: number
  activeAgents: number
  timezone: string
}

interface AgentDistributionMapProps {
  locations: LocationData[]
}

export function AgentDistributionMap({ locations }: AgentDistributionMapProps) {
  // Calculate map bounds
  const validLocations = locations.filter(loc => 
    loc.city && cityCoordinates[loc.city]
  )

  if (validLocations.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        <div className="text-center">
          <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No location data available</p>
        </div>
      </div>
    )
  }

  // Find bounds for scaling
  const lats = validLocations.map(loc => cityCoordinates[loc.city!].lat)
  const lngs = validLocations.map(loc => cityCoordinates[loc.city!].lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  // Add padding to bounds
  const latPadding = (maxLat - minLat) * 0.1
  const lngPadding = (maxLng - minLng) * 0.1

  // Convert coordinates to SVG points (simplified mercator projection)
  const mapWidth = 400
  const mapHeight = 300
  
  const getPoint = (lat: number, lng: number) => {
    const x = ((lng - minLng + lngPadding) / (maxLng - minLng + 2 * lngPadding)) * mapWidth
    const y = mapHeight - ((lat - minLat + latPadding) / (maxLat - minLat + 2 * latPadding)) * mapHeight
    return { x, y }
  }

  // Get max agent count for scaling
  const maxAgents = Math.max(...validLocations.map(loc => loc.agentCount), 1)

  return (
    <div className="relative">
      <svg
        width="100%"
        height="300"
        viewBox={`0 0 ${mapWidth} ${mapHeight}`}
        className="w-full h-full"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='300' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='20' height='20' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 20 0 L 0 0 0 20' fill='none' stroke='%23e2e8f0' stroke-width='0.5'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='%23f8fafc'/%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`,
          backgroundSize: 'cover',
          borderRadius: '0.5rem',
          border: '1px solid #e2e8f0'
        }}
      >
            {/* Draw connections between cities (optional) */}
            {validLocations.map((loc, i) => {
              if (!loc.city || !cityCoordinates[loc.city]) return null
              const point = getPoint(
                cityCoordinates[loc.city].lat,
                cityCoordinates[loc.city].lng
              )
              
              // Draw connections to nearby cities
              return validLocations.slice(i + 1).map((otherLoc, j) => {
                if (!otherLoc.city || !cityCoordinates[otherLoc.city]) return null
                const otherPoint = getPoint(
                  cityCoordinates[otherLoc.city].lat,
                  cityCoordinates[otherLoc.city].lng
                )
                
                // Calculate distance
                const distance = Math.sqrt(
                  Math.pow(point.x - otherPoint.x, 2) + 
                  Math.pow(point.y - otherPoint.y, 2)
                )
                
                // Only draw if cities are relatively close
                if (distance < 200) {
                  return (
                    <line
                      key={`${loc.id}-${otherLoc.id}`}
                      x1={point.x}
                      y1={point.y}
                      x2={otherPoint.x}
                      y2={otherPoint.y}
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                  )
                }
                return null
              })
            })}

            {/* Draw cities */}
            {validLocations.map(loc => {
              if (!loc.city || !cityCoordinates[loc.city]) return null
              
              const coords = cityCoordinates[loc.city]
              const point = getPoint(coords.lat, coords.lng)
              const radius = 5 + (loc.agentCount / maxAgents) * 25
              
              return (
                <g key={loc.id}>
                  {/* Outer circle for total agents */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={radius}
                    fill="#3b82f6"
                    fillOpacity="0.2"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />
                  
                  {/* Inner circle for active agents */}
                  {loc.activeAgents > 0 && (
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={radius * (loc.activeAgents / loc.agentCount)}
                      fill="#3b82f6"
                      fillOpacity="0.6"
                    />
                  )}
                  
                  {/* Center dot */}
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="2"
                    fill="#1e40af"
                  />
                  
                  {/* Label */}
                  <text
                    x={point.x}
                    y={point.y - radius - 5}
                    textAnchor="middle"
                    className="text-[10px] font-medium fill-slate-700"
                  >
                    {loc.city}
                  </text>
                  
                  {/* Agent count */}
                  <text
                    x={point.x}
                    y={point.y + radius + 12}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-600"
                  >
                    {loc.agentCount}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 opacity-60"></div>
              <span>Active</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500 opacity-20 border border-blue-500"></div>
              <span>Total</span>
            </div>
          </div>
        </div>
  )
}