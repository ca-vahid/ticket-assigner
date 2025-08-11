import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle,
  XCircle,
  User,
  Tag,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckSquare,
  Square,
  Sparkles,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PendingSkillsReviewProps {
  pendingSkills: {
    total: number;
    byAgent: Record<string, {
      agentName: string;
      skills: any[];
    }>;
    byMethod: Record<string, number>;
  };
  onUpdate: () => void;
}

export function PendingSkillsReviewV2({ pendingSkills, onUpdate }: PendingSkillsReviewProps) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  
  // Auto-expand if there are 3 or fewer agents
  useEffect(() => {
    const agentCount = Object.keys(pendingSkills.byAgent || {}).length;
    if (agentCount > 0 && agentCount <= 3 && expandedAgents.size === 0) {
      setExpandedAgents(new Set(Object.keys(pendingSkills.byAgent)));
    }
  }, [pendingSkills.byAgent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        selectAll();
      }
      // Ctrl/Cmd + Shift + A: Deselect all
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        deselectAll();
      }
      // Ctrl/Cmd + Enter: Approve selected
      else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && selectedSkills.size > 0) {
        e.preventDefault();
        approveSelected();
      }
      // Escape: Clear selection
      else if (e.key === 'Escape') {
        deselectAll();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedSkills, pendingSkills]);

  const toggleAgentExpanded = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const toggleAgentSelection = (agentId: string) => {
    const agent = pendingSkills.byAgent[agentId];
    if (!agent || !agent.skills) return;
    
    const agentSkillIds = agent.skills.map(s => s.id);
    const newSelection = new Set(selectedSkills);
    const newAgentSelection = new Set(selectedAgents);
    
    const allSelected = agentSkillIds.every(id => selectedSkills.has(id));
    
    if (allSelected) {
      // Deselect all skills for this agent
      agentSkillIds.forEach(id => newSelection.delete(id));
      newAgentSelection.delete(agentId);
    } else {
      // Select all skills for this agent
      agentSkillIds.forEach(id => newSelection.add(id));
      newAgentSelection.add(agentId);
    }
    
    setSelectedSkills(newSelection);
    setSelectedAgents(newAgentSelection);
  };

  const toggleSkillSelection = (skillId: string, agentId: string) => {
    const newSelection = new Set(selectedSkills);
    if (newSelection.has(skillId)) {
      newSelection.delete(skillId);
    } else {
      newSelection.add(skillId);
    }
    setSelectedSkills(newSelection);
    
    // Update agent selection status
    const agent = pendingSkills.byAgent[agentId];
    const agentSkillIds = agent.skills.map(s => s.id);
    const allSelected = agentSkillIds.every(id => newSelection.has(id));
    
    const newAgentSelection = new Set(selectedAgents);
    if (allSelected) {
      newAgentSelection.add(agentId);
    } else {
      newAgentSelection.delete(agentId);
    }
    setSelectedAgents(newAgentSelection);
  };

  const selectAll = () => {
    const allSkillIds = new Set<string>();
    const allAgentIds = new Set<string>();
    Object.entries(pendingSkills.byAgent).forEach(([agentId, agent]) => {
      allAgentIds.add(agentId);
      agent.skills.forEach(skill => allSkillIds.add(skill.id));
    });
    setSelectedSkills(allSkillIds);
    setSelectedAgents(allAgentIds);
  };

  const deselectAll = () => {
    setSelectedSkills(new Set());
    setSelectedAgents(new Set());
  };

  const approveSelected = async () => {
    if (selectedSkills.size === 0) return;
    
    setProcessing(true);
    try {
      const response = await fetch('/api/skills/detected/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds: Array.from(selectedSkills),
          approvedBy: 'Admin'
        })
      });
      
      if (response.ok) {
        setSelectedSkills(new Set());
        setSelectedAgents(new Set());
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to approve skills:', error);
    } finally {
      setProcessing(false);
    }
  };

  const rejectSelected = async () => {
    if (selectedSkills.size === 0) return;
    
    setProcessing(true);
    try {
      const response = await fetch('/api/skills/detected/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds: Array.from(selectedSkills),
          rejectedBy: 'Admin',
          reason: rejectReason
        })
      });
      
      if (response.ok) {
        setSelectedSkills(new Set());
        setSelectedAgents(new Set());
        setRejectReason('');
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to reject skills:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return '🟢';
    if (confidence >= 0.6) return '🟡';
    return '🔴';
  };

  if (pendingSkills.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">No Pending Skills</p>
            <p className="text-sm text-muted-foreground mt-2">
              All detected skills have been reviewed
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const agents = Object.entries(pendingSkills.byAgent);
  const filteredAgents = showOnlySelected 
    ? agents.filter(([agentId]) => {
        const agent = pendingSkills.byAgent[agentId];
        return agent.skills.some(skill => selectedSkills.has(skill.id));
      })
    : agents;

  return (
    <div className="space-y-4">
      {/* Compact Action Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={selectedSkills.size > 0 ? deselectAll : selectAll}
                className="h-8"
                title={selectedSkills.size > 0 ? "Clear selection (Esc)" : "Select all (Ctrl+A)"}
              >
                {selectedSkills.size > 0 ? (
                  <>
                    <Square className="h-3 w-3 mr-1" />
                    Clear
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3 w-3 mr-1" />
                    All
                  </>
                )}
              </Button>
              
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{selectedSkills.size}</span>
                <span className="text-muted-foreground">of</span>
                <span className="font-medium">{pendingSkills.total}</span>
                <span className="text-muted-foreground">selected</span>
              </div>

              {selectedSkills.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowOnlySelected(!showOnlySelected)}
                  className="h-8 text-xs"
                >
                  {showOnlySelected ? 'Show All' : 'Show Selected'}
                </Button>
              )}
            </div>

            {selectedSkills.size > 0 && (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Rejection reason..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-48 h-8 text-sm"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={rejectSelected}
                  disabled={processing}
                  className="h-8"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Reject
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={approveSelected}
                  disabled={processing}
                  className="h-8 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-2">
        {pendingSkills.byMethod && Object.entries(pendingSkills.byMethod).map(([method, count]) => (
          <div key={method} className="bg-white p-2 rounded-lg border text-center">
            <div className="text-xs text-muted-foreground">{method.replace(/_/g, ' ')}</div>
            <div className="text-lg font-semibold">{count}</div>
          </div>
        ))}
      </div>

      {/* Compact Agent Cards */}
      <div className="space-y-2">
        {filteredAgents.map(([agentId, agentData]) => {
          const isExpanded = expandedAgents.has(agentId);
          const agentSkillIds = agentData.skills.map(s => s.id);
          const selectedCount = agentSkillIds.filter(id => selectedSkills.has(id)).length;
          const allSelected = selectedCount === agentData.skills.length && selectedCount > 0;
          const someSelected = selectedCount > 0 && !allSelected;
          
          return (
            <Card key={agentId} className={cn(
              "transition-all duration-200",
              selectedCount > 0 && "border-blue-400 bg-blue-50/50"
            )}>
              <div 
                className="px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleAgentExpanded(agentId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={processing}
                      onCheckedChange={() => {
                        toggleAgentSelection(agentId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <User className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">{agentData.agentName}</span>
                    
                    <Badge variant="outline" className="text-xs">
                      {agentData.skills.length} skills
                    </Badge>
                    
                    {selectedCount > 0 && (
                      <Badge className="text-xs bg-blue-600">
                        {selectedCount} selected
                      </Badge>
                    )}
                  </div>
                  
                  {!isExpanded && (
                    <div className="flex items-center gap-2">
                      {agentData.skills.slice(0, 3).map(skill => (
                        <Badge key={skill.id} variant="secondary" className="text-xs">
                          {skill.skillName.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                      {agentData.skills.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{agentData.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {isExpanded && (
                <CardContent className="pt-0 pb-3">
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {agentData.skills.map((skill) => (
                      <div 
                        key={skill.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-colors",
                          selectedSkills.has(skill.id) 
                            ? "border-blue-400 bg-blue-50" 
                            : "border-gray-200 hover:bg-gray-50"
                        )}
                      >
                        <Checkbox
                          checked={selectedSkills.has(skill.id)}
                          disabled={processing}
                          onCheckedChange={() => toggleSkillSelection(skill.id, agentId)}
                        />
                        
                        <div className="flex-1 flex items-center gap-2">
                          <Tag className="h-3 w-3 text-gray-500" />
                          <span className="text-sm font-medium">
                            {skill.skillName.replace(/_/g, ' ')}
                          </span>
                          
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {skill.detectionMethod.replace(/_/g, ' ')}
                          </Badge>
                          
                          <span className="text-xs">
                            {getConfidenceIcon(skill.confidence)}
                            {' '}
                            {(skill.confidence * 100).toFixed(0)}%
                          </span>
                          
                          {skill.metadata?.ticketCount && (
                            <span className="text-xs text-muted-foreground">
                              ({skill.metadata.ticketCount} tickets)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const skillIds = agentData.skills.map(s => s.id);
                        skillIds.forEach(id => selectedSkills.delete(id));
                        setSelectedSkills(new Set(selectedSkills));
                        setSelectedAgents(new Set(selectedAgents));
                      }}
                      className="h-7 text-xs"
                    >
                      Clear Agent
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={async () => {
                        const skillIds = agentData.skills.map(s => s.id);
                        setProcessing(true);
                        try {
                          const response = await fetch('/api/skills/detected/approve', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              skillIds,
                              approvedBy: 'Admin'
                            })
                          });
                          if (response.ok) {
                            onUpdate();
                          }
                        } finally {
                          setProcessing(false);
                        }
                      }}
                      disabled={processing}
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Approve All {agentData.skills.length}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}