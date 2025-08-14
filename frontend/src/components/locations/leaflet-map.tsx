'use client'

import React, { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
})

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
  'Colorado': { lat: 39.5501, lng: -105.7821, province: 'USA' },
  'Remote': { lat: 56.0, lng: -96.0, province: 'Remote' } // Center of Canada for remote
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

interface LeafletMapProps {
  locations: LocationData[]
}

export default function LeafletMap({ locations }: LeafletMapProps) {
  useEffect(() => {
    // Initialize map
    const map = L.map('map', {
      center: [56.130366, -106.346771], // Center of Canada
      zoom: 3,
      scrollWheelZoom: false,
    })

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)

    // Get max agent count for scaling
    const maxAgents = Math.max(...locations.map(loc => loc.agentCount || 0), 1)

    // Add markers for each location
    locations.forEach(location => {
      const cityName = location.city || location.name
      const coords = cityCoordinates[cityName]
      
      if (coords) {
        const radius = 10 + (location.agentCount / maxAgents) * 30
        
        // Create circle marker
        const circle = L.circleMarker([coords.lat, coords.lng], {
          radius: radius,
          fillColor: '#3b82f6',
          color: '#1e40af',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.3 + (location.activeAgents / location.agentCount) * 0.5
        }).addTo(map)

        // Add popup
        circle.bindPopup(`
          <div style="text-align: center;">
            <strong>${cityName}</strong><br/>
            Agents: ${location.agentCount}<br/>
            Active: ${location.activeAgents}<br/>
            Timezone: ${location.timezone}
          </div>
        `)

        // Add label
        const label = L.divIcon({
          html: `<div style="text-align: center; white-space: nowrap;">
            <div style="font-size: 11px; font-weight: 600; color: #1e40af;">${cityName}</div>
            <div style="font-size: 10px; color: #64748b;">${location.agentCount} agents</div>
          </div>`,
          className: 'leaflet-label',
          iconSize: [100, 40],
          iconAnchor: [50, 20]
        })
        
        L.marker([coords.lat, coords.lng], { icon: label }).addTo(map)
      }
    })

    // Fit bounds to show all markers
    if (locations.length > 0) {
      const validLocations = locations.filter(loc => {
        const cityName = loc.city || loc.name
        return cityCoordinates[cityName]
      })
      
      if (validLocations.length > 0) {
        const bounds = validLocations.map(loc => {
          const cityName = loc.city || loc.name
          const coords = cityCoordinates[cityName]!
          return [coords.lat, coords.lng] as [number, number]
        })
        
        map.fitBounds(bounds, { padding: [50, 50] })
      }
    }

    // Cleanup
    return () => {
      map.remove()
    }
  }, [locations])

  return (
    <div className="relative">
      <div id="map" style={{ height: '300px', width: '100%', borderRadius: '0.5rem' }} />
      <style jsx global>{`
        .leaflet-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}