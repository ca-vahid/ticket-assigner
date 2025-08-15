import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Shield, Briefcase, Calendar, Save, TicketIcon, TrendingUp, AlertCircle } from 'lucide-react';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAvailable: boolean;
  level: string;
  skills: string[];
  autoDetectedSkills?: string[];
  skillMetadata?: {
    manual?: string[];
    category?: { skill: string; confidence: number; ticketCount: number }[];
  };
  currentTicketCount: number;
  weightedTicketCount?: number;
  ticketWorkloadBreakdown?: {
    fresh: number;
    recent: number;
    stale: number;
    abandoned: number;
  };
  maxConcurrentTickets?: number;
  totalAssignments?: number;
  lastAssignmentDate?: string;
  isPto?: boolean;
  currentLeaveType?: string;
  ptoStartDate?: string;
  ptoEndDate?: string;
  lastVacationTrackerSync?: string;
}

interface AgentDetailProps {
  agent: Agent;
  onUpdate: (updates: Partial<Agent>) => void;
}

export function AgentDetail({ agent, onUpdate }: AgentDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAgent, setEditedAgent] = useState(agent);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onUpdate(editedAgent);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Calculate individual weighted contributions
  const calculateWeightedContribution = (count: number, weight: number) => count * weight;
  
  // Dynamic max based on actual workload - use weighted count if available
  const currentWorkload = Number(agent.weightedTicketCount) || agent.currentTicketCount;
  const dynamicMax = Math.max(10, Math.ceil(currentWorkload * 1.2)); // 20% buffer above current

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
              {agent.firstName[0]}{agent.lastName[0]}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {agent.firstName} {agent.lastName}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-gray-600">
                <Mail className="h-4 w-4" />
                <span className="text-sm">{agent.email}</span>
              </div>
            </div>
          </div>
          
          {isEditing ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditedAgent(agent);
                  setIsEditing(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Availability */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Availability</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={isEditing ? editedAgent.isAvailable : agent.isAvailable}
                onCheckedChange={(checked) => 
                  isEditing && setEditedAgent({ ...editedAgent, isAvailable: checked })
                }
                disabled={!isEditing}
              />
              <span className="text-sm">
                {(isEditing ? editedAgent.isAvailable : agent.isAvailable) ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>

          {/* Level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Support Level</Label>
            {isEditing ? (
              <Select
                value={editedAgent.level}
                onValueChange={(value) => setEditedAgent({ ...editedAgent, level: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">Level 1</SelectItem>
                  <SelectItem value="L2">Level 2</SelectItem>
                  <SelectItem value="L3">Level 3</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-500" />
                <Badge>{agent.level}</Badge>
              </div>
            )}
          </div>

          {/* Statistics */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Statistics</Label>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4" />
                <span>Total Assignments: {agent.totalAssignments || 0}</span>
              </div>
              {agent.lastAssignmentDate && (
                <div className="text-xs text-gray-500">
                  Last assigned: {new Date(agent.lastAssignmentDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Prominent Workload Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TicketIcon className="h-5 w-5" />
            Ticket Workload Analysis
          </h3>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-blue-900">
              {agent.currentTicketCount || 0}
            </div>
            <div className="text-sm text-gray-600 mt-1">Raw Tickets</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm">
            <div className="text-3xl font-bold text-orange-600">
              {agent.weightedTicketCount ? Number(agent.weightedTicketCount).toFixed(1) : agent.currentTicketCount}
            </div>
            <div className="text-sm text-gray-600 mt-1">Weighted Score</div>
          </div>
          <div className="bg-white rounded-lg p-4 text-center shadow-sm flex flex-col items-center justify-center">
            <Badge 
              className="text-lg px-3 py-1" 
              variant={
                (Number(agent.weightedTicketCount) || agent.currentTicketCount) > 7 ? "destructive" : 
                (Number(agent.weightedTicketCount) || agent.currentTicketCount) > 5 ? "secondary" : "default"
              }
            >
              {(Number(agent.weightedTicketCount) || agent.currentTicketCount) > 7 ? 'HIGH LOAD' : 
               (Number(agent.weightedTicketCount) || agent.currentTicketCount) > 5 ? 'MEDIUM' : 'LOW'}
            </Badge>
            <div className="text-xs text-gray-600 mt-1">Status</div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        {agent.ticketWorkloadBreakdown && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="text-sm font-bold text-gray-700 mb-3">Weighted Capacity Calculation Breakdown:</h4>
              
              <div className="space-y-3">
                {agent.ticketWorkloadBreakdown.fresh > 0 && (
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <div>
                        <span className="font-semibold text-red-700">Fresh Tickets</span>
                        <span className="text-xs text-red-600 block">0-1 days old</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-red-600">
                        {agent.ticketWorkloadBreakdown.fresh} × 2.0
                      </div>
                      <div className="text-sm font-semibold text-red-700">
                        = {calculateWeightedContribution(agent.ticketWorkloadBreakdown.fresh, 2.0).toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
                
                {agent.ticketWorkloadBreakdown.recent > 0 && (
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <div>
                        <span className="font-semibold text-orange-700">Recent Tickets</span>
                        <span className="text-xs text-orange-600 block">2-5 days old</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-orange-600">
                        {agent.ticketWorkloadBreakdown.recent} × 1.2
                      </div>
                      <div className="text-sm font-semibold text-orange-700">
                        = {calculateWeightedContribution(agent.ticketWorkloadBreakdown.recent, 1.2).toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
                
                {agent.ticketWorkloadBreakdown.stale > 0 && (
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div>
                        <span className="font-semibold text-yellow-700">Stale Tickets</span>
                        <span className="text-xs text-yellow-600 block">6-14 days old</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-yellow-600">
                        {agent.ticketWorkloadBreakdown.stale} × 0.5
                      </div>
                      <div className="text-sm font-semibold text-yellow-700">
                        = {calculateWeightedContribution(agent.ticketWorkloadBreakdown.stale, 0.5).toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
                
                {agent.ticketWorkloadBreakdown.abandoned > 0 && (
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-300">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <div>
                        <span className="font-semibold text-gray-700">Old Tickets</span>
                        <span className="text-xs text-gray-600 block">15+ days old</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-mono font-bold text-gray-600">
                        {agent.ticketWorkloadBreakdown.abandoned} × 0.1
                      </div>
                      <div className="text-sm font-semibold text-gray-700">
                        = {calculateWeightedContribution(agent.ticketWorkloadBreakdown.abandoned, 0.1).toFixed(1)}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Total */}
                <div className="pt-3 mt-3 border-t-2 border-gray-300">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-800">Total Weighted Score:</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {agent.weightedTicketCount ? Number(agent.weightedTicketCount).toFixed(1) : '0.0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Capacity Bar */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                <span>Capacity Usage</span>
                <span>
                  {agent.weightedTicketCount ? Number(agent.weightedTicketCount).toFixed(1) : agent.currentTicketCount} / {dynamicMax}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div 
                  className={`h-4 rounded-full transition-all flex items-center justify-end pr-2 ${
                    (currentWorkload / dynamicMax) > 0.8 ? 'bg-red-500' :
                    (currentWorkload / dynamicMax) > 0.6 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((currentWorkload / dynamicMax) * 100, 100)}%` }}
                >
                  <span className="text-xs text-white font-bold">
                    {Math.round((currentWorkload / dynamicMax) * 100)}%
                  </span>
                </div>
              </div>
            </div>
            
            {/* Info Box */}
            <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Why Weighted Scoring?
                  </p>
                  <p className="text-sm text-blue-800">
                    Fresh tickets (0-1 days) are weighted 2x to prevent agents from hoarding old tickets 
                    to avoid new assignments. This ensures fair distribution and timely ticket resolution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!agent.ticketWorkloadBreakdown && (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">No ticket breakdown data available</p>
            <p className="text-sm text-gray-400 mt-2">Run ticket sync to update workload data</p>
          </div>
        )}
      </Card>
    </div>
  );
}