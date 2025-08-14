'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  MapPin,
  Users,
  Clock,
  Settings,
  UserPlus,
  UserMinus,
  Save,
  Loader2,
  Info,
  Globe,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { apiService } from '@/services/api'

interface Location {
  id: string
  name: string
  city?: string
  country?: string
  timezone: string
  isActive: boolean
  metadata?: {
    officeHours?: {
      start: string
      end: string
      days: string[]
    }
    supportTypes?: string[]
  }
}

interface Agent {
  id: string
  firstName: string
  lastName: string
  email: string
  isAvailable: boolean
  skills: string[]
  location?: Location
}

interface LocationConfigDialogProps {
  location: Location
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function LocationConfigDialog({
  location,
  isOpen,
  onClose,
  onUpdate
}: LocationConfigDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [allAgents, setAllAgents] = useState<Agent[]>([])
  const [locationSettings, setLocationSettings] = useState({
    timezone: location.timezone,
    isActive: location.isActive,
    officeHours: location.metadata?.officeHours || {
      start: '09:00',
      end: '17:00',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
    },
    supportTypes: location.metadata?.supportTypes || ['onsite', 'remote']
  })
  const [selectedAgentsToAdd, setSelectedAgentsToAdd] = useState<string[]>([])
  const [selectedAgentsToRemove, setSelectedAgentsToRemove] = useState<string[]>([])

  useEffect(() => {
    if (isOpen) {
      fetchLocationData()
    }
  }, [isOpen, location.id])

  const fetchLocationData = async () => {
    setIsLoading(true)
    try {
      // Fetch agents in this location
      const [agentsResponse, allAgentsResponse] = await Promise.all([
        apiService.getLocationAgents(location.id),
        apiService.getAgents()
      ])
      
      setAgents(agentsResponse.data || [])
      setAllAgents(allAgentsResponse.data || [])
    } catch (error) {
      toast.error('Failed to fetch location data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      await apiService.updateLocation(location.id, {
        timezone: locationSettings.timezone,
        metadata: {
          officeHours: locationSettings.officeHours,
          supportTypes: locationSettings.supportTypes
        }
      })
      toast.success('Location settings updated')
      onUpdate()
    } catch (error) {
      toast.error('Failed to update location settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddAgents = async () => {
    if (selectedAgentsToAdd.length === 0) {
      toast.error('Please select agents to add')
      return
    }

    setIsLoading(true)
    try {
      // Update each selected agent's location
      await Promise.all(
        selectedAgentsToAdd.map(agentId =>
          apiService.updateAgent(agentId, { location: location })
        )
      )
      
      toast.success(`Added ${selectedAgentsToAdd.length} agents to ${location.name}`)
      setSelectedAgentsToAdd([])
      await fetchLocationData()
      onUpdate()
    } catch (error) {
      console.error('Failed to add agents:', error)
      toast.error('Failed to add agents')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveAgents = async () => {
    if (selectedAgentsToRemove.length === 0) {
      toast.error('Please select agents to remove')
      return
    }

    setIsLoading(true)
    try {
      // Remove location from selected agents
      await Promise.all(
        selectedAgentsToRemove.map(agentId =>
          apiService.updateAgent(agentId, { location: null })
        )
      )
      
      toast.success(`Removed ${selectedAgentsToRemove.length} agents from ${location.name}`)
      setSelectedAgentsToRemove([])
      await fetchLocationData()
      onUpdate()
    } catch (error) {
      console.error('Failed to remove agents:', error)
      toast.error('Failed to remove agents')
    } finally {
      setIsLoading(false)
    }
  }

  const availableAgents = allAgents.filter(
    agent => !agent.location || agent.location.id !== location.id
  )

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const timezones = [
    'America/Vancouver',
    'America/Edmonton',
    'America/Winnipeg',
    'America/Toronto',
    'America/Montreal',
    'America/Halifax',
    'America/St_Johns',
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles'
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Configure Location: {location.name}
          </DialogTitle>
          <DialogDescription>
            Manage agents and settings for this location
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="agents" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="agents">
              <Users className="h-4 w-4 mr-2" />
              Agents ({agents.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="hours">
              <Clock className="h-4 w-4 mr-2" />
              Office Hours
            </TabsTrigger>
          </TabsList>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            <div className="grid gap-4">
              {/* Current Agents */}
              <div>
                <h3 className="text-sm font-medium mb-2">Current Agents in {location.name}</h3>
                <ScrollArea className="h-[200px] border rounded-lg p-3">
                  {agents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No agents assigned to this location
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {agents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAgentsToRemove.includes(agent.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAgentsToRemove([...selectedAgentsToRemove, agent.id])
                                } else {
                                  setSelectedAgentsToRemove(
                                    selectedAgentsToRemove.filter(id => id !== agent.id)
                                  )
                                }
                              }}
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {agent.firstName} {agent.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">{agent.email}</p>
                            </div>
                          </div>
                          <Badge variant={agent.isAvailable ? 'default' : 'secondary'}>
                            {agent.isAvailable ? 'Available' : 'Unavailable'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {selectedAgentsToRemove.length > 0 && (
                  <Button
                    className="mt-2"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemoveAgents}
                    disabled={isLoading}
                  >
                    <UserMinus className="h-4 w-4 mr-2" />
                    Remove {selectedAgentsToRemove.length} Selected
                  </Button>
                )}
              </div>

              {/* Add Agents */}
              <div>
                <h3 className="text-sm font-medium mb-2">Add Agents to {location.name}</h3>
                <ScrollArea className="h-[200px] border rounded-lg p-3">
                  {availableAgents.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                      No available agents to add
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {availableAgents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={selectedAgentsToAdd.includes(agent.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAgentsToAdd([...selectedAgentsToAdd, agent.id])
                                } else {
                                  setSelectedAgentsToAdd(
                                    selectedAgentsToAdd.filter(id => id !== agent.id)
                                  )
                                }
                              }}
                            />
                            <div>
                              <p className="font-medium text-sm">
                                {agent.firstName} {agent.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Currently in: {agent.location?.name || 'No location'}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {selectedAgentsToAdd.length > 0 && (
                  <Button
                    className="mt-2"
                    size="sm"
                    onClick={handleAddAgents}
                    disabled={isLoading}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add {selectedAgentsToAdd.length} Selected
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={locationSettings.timezone}
                  onValueChange={(value) =>
                    setLocationSettings({ ...locationSettings, timezone: value })
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {tz}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Location Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable this location for assignments
                  </p>
                </div>
                <Switch
                  checked={locationSettings.isActive}
                  onCheckedChange={(checked) =>
                    setLocationSettings({ ...locationSettings, isActive: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Support Types</Label>
                <div className="space-y-2">
                  {['onsite', 'remote', 'hybrid'].map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={type}
                        checked={locationSettings.supportTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLocationSettings({
                              ...locationSettings,
                              supportTypes: [...locationSettings.supportTypes, type]
                            })
                          } else {
                            setLocationSettings({
                              ...locationSettings,
                              supportTypes: locationSettings.supportTypes.filter(t => t !== type)
                            })
                          }
                        }}
                      />
                      <Label htmlFor={type} className="capitalize">
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Office Hours Tab */}
          <TabsContent value="hours" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={locationSettings.officeHours.start}
                    onChange={(e) =>
                      setLocationSettings({
                        ...locationSettings,
                        officeHours: {
                          ...locationSettings.officeHours,
                          start: e.target.value
                        }
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={locationSettings.officeHours.end}
                    onChange={(e) =>
                      setLocationSettings({
                        ...locationSettings,
                        officeHours: {
                          ...locationSettings.officeHours,
                          end: e.target.value
                        }
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="grid grid-cols-2 gap-2">
                  {weekDays.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={day}
                        checked={locationSettings.officeHours.days.includes(day)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLocationSettings({
                              ...locationSettings,
                              officeHours: {
                                ...locationSettings.officeHours,
                                days: [...locationSettings.officeHours.days, day]
                              }
                            })
                          } else {
                            setLocationSettings({
                              ...locationSettings,
                              officeHours: {
                                ...locationSettings.officeHours,
                                days: locationSettings.officeHours.days.filter(d => d !== day)
                              }
                            })
                          }
                        }}
                      />
                      <Label htmlFor={day}>{day}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Office hours are used to determine agent availability based on their location's timezone.
                  Agents outside office hours won't be assigned tickets unless it's an emergency.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSaveSettings} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}