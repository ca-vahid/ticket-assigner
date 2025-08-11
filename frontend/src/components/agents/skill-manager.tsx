import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { X, Plus, GripVertical, Sparkles, Search, Tag, Brain, CheckCircle, XCircle, Loader2, TicketIcon, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  skills: string[];
  autoDetectedSkills?: string[];
  skillMetadata?: {
    manual?: string[];
    category?: { skill: string; confidence: number; ticketCount: number }[];
  };
}

interface SkillManagerProps {
  agent: Agent;
  onSkillsUpdate: (skills: string[]) => void;
  onDetectSkills?: (agentId: string, agentName: string) => Promise<void>;
}

// Predefined skill categories for better UX
const SKILL_CATEGORIES = {
  'General': [
    'general_support',
    'password_reset',
    'basic_troubleshooting',
    'user_training'
  ],
  'Software': [
    'software',
    'installation',
    'office_365',
    'adobe_suite',
    'sap',
    'salesforce'
  ],
  'Infrastructure': [
    'active_directory',
    'windows',
    'linux',
    'mac_os',
    'server_management',
    'azure',
    'aws'
  ],
  'Network': [
    'network',
    'vpn',
    'connectivity',
    'firewall',
    'dns',
    'routing'
  ],
  'Security': [
    'security',
    'mfa',
    'access_control',
    'incident_response',
    'compliance'
  ],
  'Hardware': [
    'hardware',
    'printer_support',
    'mobile_devices',
    'peripherals'
  ]
};

export function SkillManager({ agent, onSkillsUpdate, onDetectSkills }: SkillManagerProps) {
  const [agentSkills, setAgentSkills] = useState<string[]>(agent.skills || []);
  const [freshserviceCategories, setFreshserviceCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Update skills when agent changes
  useEffect(() => {
    setAgentSkills(agent.skills || []);
  }, [agent.id, agent.skills]);
  
  // Fetch Freshservice categories on mount
  useEffect(() => {
    fetchFreshserviceCategories();
  }, []);
  
  const fetchFreshserviceCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/skills/categories');
      if (response.ok) {
        const categories = await response.json();
        const categoryNames = categories.map((cat: any) => 
          cat.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        );
        setFreshserviceCategories(categoryNames);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };
  
  // Determine which skills are detected vs manual
  const detectedSkills = agent.autoDetectedSkills || [];
  const categorySkills = agent.skillMetadata?.category?.map(c => c.skill) || [];
  const [searchTerm, setSearchTerm] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [draggedSkill, setDraggedSkill] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const dragCounter = useRef(0);

  const handleDragStart = (skill: string, index?: number) => {
    setDraggedSkill(skill);
    if (index !== undefined) {
      setDraggedIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedSkill(null);
    setDraggedIndex(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault();
    
    if (!draggedSkill) return;

    let newSkills = [...agentSkills];
    
    // If dragging from available skills to agent skills
    if (draggedIndex === null) {
      if (!agentSkills.includes(draggedSkill)) {
        if (targetIndex !== undefined) {
          newSkills.splice(targetIndex, 0, draggedSkill);
        } else {
          newSkills.push(draggedSkill);
        }
      }
    } 
    // If reordering within agent skills
    else if (draggedIndex !== null && targetIndex !== undefined && draggedIndex !== targetIndex) {
      const [removed] = newSkills.splice(draggedIndex, 1);
      newSkills.splice(targetIndex, 0, removed);
    }
    
    setAgentSkills(newSkills);
    handleDragEnd();
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setAgentSkills(agentSkills.filter(skill => skill !== skillToRemove));
  };

  const handleAddCustomSkill = () => {
    if (customSkill && !agentSkills.includes(customSkill)) {
      setAgentSkills([...agentSkills, customSkill.toLowerCase().replace(/\s+/g, '_')]);
      setCustomSkill('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSkillsUpdate(agentSkills);
    } finally {
      setSaving(false);
    }
  };

  // Combine predefined skills with Freshservice categories
  const allSkillCategories = {
    ...SKILL_CATEGORIES,
    ...(freshserviceCategories.length > 0 ? {
      'Freshservice Categories': freshserviceCategories
    } : {})
  };
  
  const filteredSkills = Object.entries(allSkillCategories).reduce((acc, [category, skills]) => {
    const filtered = skills.filter(skill => 
      skill.includes(searchTerm.toLowerCase()) && !agentSkills.includes(skill)
    );
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-purple-600" />
          <h3 className="text-sm font-semibold">Skills</h3>
          <Badge variant="secondary" className="text-xs">
            {agentSkills.length}
          </Badge>
        </div>
        <div className="flex gap-2">
          {onDetectSkills && (
            <Button
              size="sm"
              onClick={async () => {
                setDetecting(true);
                setDetectionResult(null);
                try {
                  // Call the parent's handler which will make the API call
                  await onDetectSkills(agent.id, `${agent.firstName} ${agent.lastName}`);
                  // Parent handler should update its own state
                  // We'll just show a success message
                  setDetectionResult({
                    success: true,
                    message: 'Skill detection completed. Check results above.'
                  });
                } catch (error) {
                  console.error('Skill detection error:', error);
                  setDetectionResult({
                    success: false,
                    message: 'Failed to detect skills. Check console for details.'
                  });
                } finally {
                  setDetecting(false);
                }
              }}
              disabled={detecting}
              variant="outline"
              className="h-7 text-xs"
            >
              {detecting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Brain className="h-3 w-3 mr-1" />
                  Detect
                </>
              )}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            variant="outline"
            className="h-7 text-xs"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Detection Progress */}
      {detecting && (
        <Alert className="mb-4 border-blue-500 bg-blue-50">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              <AlertDescription className="text-xs font-medium">
                Detecting skills for {agent.firstName} {agent.lastName}...
              </AlertDescription>
            </div>
            <div className="space-y-1">
              <Progress value={33} className="h-1" />
              <p className="text-xs text-muted-foreground">
                Fetching ticket history and analyzing categories...
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Detection Result Alert */}
      {detectionResult && !detecting && (
        <Alert className={cn("mb-4", detectionResult.success ? "border-green-500" : "border-red-500")}>
          <div className="flex items-start gap-2">
            {detectionResult.success ? (
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
            )}
            <AlertDescription className="text-xs">
              {detectionResult.message}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Skills Legend */}
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="text-gray-500">Legend:</span>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs py-0 px-1 bg-blue-100 text-blue-800 border-blue-300">
            Manual
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs py-0 px-1 bg-green-100 text-green-800 border-green-300">
            <TicketIcon className="h-2.5 w-2.5 mr-0.5" />
            Category
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary" className="text-xs py-0 px-1 bg-purple-100 text-purple-800 border-purple-300">
            <Brain className="h-2.5 w-2.5 mr-0.5" />
            Detected
          </Badge>
        </div>
      </div>

      {/* Current Skills - Compact */}
      <div className="mb-4">
        <div
          className={cn(
            "min-h-[60px] p-3 border-2 border-dashed rounded-md transition-colors",
            draggedSkill && draggedIndex === null ? "border-blue-400 bg-blue-50" : "border-gray-200"
          )}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e)}
        >
          {agentSkills.length === 0 ? (
            <div className="text-center text-gray-400 py-2">
              <p className="text-xs">No skills assigned - add from below</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {agentSkills.map((skill, index) => {
                const isDetected = detectedSkills.includes(skill) || categorySkills.includes(skill);
                const categoryData = agent.skillMetadata?.category?.find(c => c.skill === skill);
                const isFreshserviceCategory = freshserviceCategories.includes(skill);
                
                // Determine skill type and styling
                let skillType = 'manual';
                let badgeClass = "bg-blue-100 text-blue-800 border-blue-300"; // Default manual
                let icon = null;
                let title = 'Manually added skill';
                
                if (isDetected) {
                  skillType = 'detected';
                  badgeClass = "bg-purple-100 text-purple-800 border-purple-300";
                  icon = <Brain className="h-2.5 w-2.5 mr-1" />;
                  title = `Auto-detected skill${categoryData ? ` (${categoryData.ticketCount} tickets, ${(categoryData.confidence * 100).toFixed(0)}% confidence)` : ''}`;
                } else if (isFreshserviceCategory) {
                  skillType = 'freshservice';
                  badgeClass = "bg-green-100 text-green-800 border-green-300";
                  icon = <TicketIcon className="h-2.5 w-2.5 mr-1" />;
                  title = 'Freshservice category (manually assigned)';
                }
                
                return (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className={cn(
                      "text-xs py-0.5 px-2 cursor-move",
                      badgeClass
                    )}
                    draggable
                    onDragStart={() => handleDragStart(skill, index)}
                    onDragEnd={handleDragEnd}
                    title={title}
                  >
                    {icon}
                    {skill.replace(/_/g, ' ')}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 hover:text-red-300"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Available Skills - Compact */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-xs font-medium text-gray-600">Add Skills</Label>
          <Input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-7 text-xs flex-1"
          />
          {loadingCategories && (
            <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchFreshserviceCategories}
            className="h-7 px-2"
            title="Refresh Freshservice categories"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
          {Object.entries(filteredSkills).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No available skills</p>
          ) : (
            Object.entries(filteredSkills).map(([category, skills]) => (
              <div key={category}>
                <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
                  {category === 'Freshservice Categories' && (
                    <TicketIcon className="h-3 w-3 text-green-600" />
                  )}
                  {category}
                </div>
                <div className="flex flex-wrap gap-1">
                  {skills.map(skill => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className={cn(
                        "text-xs py-0 px-1.5 cursor-pointer",
                        category === 'Freshservice Categories' 
                          ? "hover:bg-green-100 border-green-300 text-green-700"
                          : "hover:bg-blue-100"
                      )}
                      onClick={() => !agentSkills.includes(skill) && setAgentSkills([...agentSkills, skill])}
                      title={category === 'Freshservice Categories' ? 'Freshservice category' : 'Predefined skill'}
                    >
                      + {skill.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Custom Skill - Compact */}
        <div className="mt-3 flex gap-1">
          <Input
            type="text"
            placeholder="Custom skill..."
            value={customSkill}
            onChange={(e) => setCustomSkill(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSkill()}
            className="flex-1 h-7 text-xs"
          />
          <Button
            size="sm"
            onClick={handleAddCustomSkill}
            disabled={!customSkill}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}