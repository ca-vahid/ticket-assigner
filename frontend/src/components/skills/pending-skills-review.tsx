import { useState } from 'react';
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
  TrendingUp,
  AlertCircle,
  CheckSquare,
  Square
} from 'lucide-react';

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

export function PendingSkillsReview({ pendingSkills, onUpdate }: PendingSkillsReviewProps) {
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  const toggleSkillSelection = (skillId: string) => {
    const newSelection = new Set(selectedSkills);
    if (newSelection.has(skillId)) {
      newSelection.delete(skillId);
    } else {
      newSelection.add(skillId);
    }
    setSelectedSkills(newSelection);
    setSelectAll(false);
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedSkills(new Set());
      setSelectAll(false);
    } else {
      const allSkillIds = new Set<string>();
      Object.values(pendingSkills.byAgent).forEach(agent => {
        agent.skills.forEach(skill => allSkillIds.add(skill.id));
      });
      setSelectedSkills(allSkillIds);
      setSelectAll(true);
    }
  };

  const approveSelected = async () => {
    if (selectedSkills.size === 0) return;
    
    setProcessing(true);
    try {
      const response = await fetch('http://localhost:3001/api/skills/detection/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds: Array.from(selectedSkills),
          approvedBy: 'Admin' // TODO: Get from auth context
        })
      });
      
      if (response.ok) {
        setSelectedSkills(new Set());
        setSelectAll(false);
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
      const response = await fetch('http://localhost:3001/api/skills/detection/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skillIds: Array.from(selectedSkills),
          rejectedBy: 'Admin', // TODO: Get from auth context
          reason: rejectReason
        })
      });
      
      if (response.ok) {
        setSelectedSkills(new Set());
        setRejectReason('');
        setSelectAll(false);
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to reject skills:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getMethodColor = (method: string) => {
    const colors = {
      'CATEGORY_BASED': 'bg-blue-100 text-blue-700',
      'GROUP_MEMBERSHIP': 'bg-green-100 text-green-700',
      'RESOLUTION_PATTERNS': 'bg-purple-100 text-purple-700',
      'TEXT_ANALYSIS_LLM': 'bg-orange-100 text-orange-700'
    };
    return colors[method] || 'bg-gray-100 text-gray-700';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
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

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
              >
                {selectAll ? (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
              
              <span className="text-sm text-muted-foreground">
                {selectedSkills.size} of {pendingSkills.total} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              {selectedSkills.size > 0 && (
                <>
                  <Input
                    placeholder="Rejection reason (optional)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-64"
                  />
                  <Button
                    variant="destructive"
                    onClick={rejectSelected}
                    disabled={processing}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject ({selectedSkills.size})
                  </Button>
                  <Button
                    variant="default"
                    onClick={approveSelected}
                    disabled={processing}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve ({selectedSkills.size})
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Method Summary */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(pendingSkills.byMethod).map(([method, count]) => (
          <Card key={method}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">
                  {method.replace(/_/g, ' ')}
                </span>
                <Badge variant="secondary">{count}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skills by Agent */}
      {Object.entries(pendingSkills.byAgent).map(([agentId, agentData]) => (
        <Card key={agentId}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {agentData.agentName}
              </div>
              <Badge variant="outline">
                {agentData.skills.length} skills
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {agentData.skills.map((skill) => (
                <div 
                  key={skill.id}
                  className={`p-3 border rounded-lg ${
                    selectedSkills.has(skill.id) ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={selectedSkills.has(skill.id)}
                      onCheckedChange={() => toggleSkillSelection(skill.id)}
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="h-4 w-4" />
                        <span className="font-medium">
                          {skill.skillName.replace(/_/g, ' ')}
                        </span>
                        <Badge 
                          variant="outline" 
                          className={getMethodColor(skill.detectionMethod)}
                        >
                          {skill.detectionMethod.replace(/_/g, ' ')}
                        </Badge>
                        {skill.confidence && (
                          <span className={`text-sm font-medium ${getConfidenceColor(skill.confidence)}`}>
                            {(skill.confidence * 100).toFixed(0)}% confidence
                          </span>
                        )}
                      </div>
                      
                      {/* Metadata */}
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {skill.metadata?.ticketCount && (
                          <div>Tickets: {skill.metadata.ticketCount}</div>
                        )}
                        {skill.metadata?.complexityScore && (
                          <div>Complexity: {skill.metadata.complexityScore.toFixed(1)}</div>
                        )}
                        {skill.metadata?.groupName && (
                          <div>Group: {skill.metadata.groupName}</div>
                        )}
                        {skill.metadata?.categories && (
                          <div>Categories: {skill.metadata.categories.join(', ')}</div>
                        )}
                      </div>
                      
                      <div className="text-xs text-muted-foreground mt-2">
                        Detected: {new Date(skill.detectedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}