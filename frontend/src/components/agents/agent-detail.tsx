import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Shield, Briefcase, Calendar, Save } from 'lucide-react';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAvailable: boolean;
  level: string;
  skills: string[];
  currentTicketCount: number;
  maxConcurrentTickets?: number;
  totalAssignments?: number;
  lastAssignmentDate?: string;
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

  return (
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

        {/* Current Workload */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Current Workload</Label>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-gray-500" />
            <span className="text-sm">{agent.currentTicketCount} active tickets</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.min((agent.currentTicketCount / (agent.maxConcurrentTickets || 10)) * 100, 100)}%` }}
            />
          </div>
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
  );
}