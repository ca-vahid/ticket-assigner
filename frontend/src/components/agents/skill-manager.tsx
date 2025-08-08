import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Plus, GripVertical, Sparkles, Search, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  skills: string[];
}

interface SkillManagerProps {
  agent: Agent;
  onSkillsUpdate: (skills: string[]) => void;
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

export function SkillManager({ agent, onSkillsUpdate }: SkillManagerProps) {
  const [agentSkills, setAgentSkills] = useState<string[]>(agent.skills || []);
  
  // Update skills when agent changes
  useEffect(() => {
    setAgentSkills(agent.skills || []);
  }, [agent.id, agent.skills]);
  const [searchTerm, setSearchTerm] = useState('');
  const [customSkill, setCustomSkill] = useState('');
  const [draggedSkill, setDraggedSkill] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
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

  const filteredSkills = Object.entries(SKILL_CATEGORIES).reduce((acc, [category, skills]) => {
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
              {agentSkills.map((skill, index) => (
                <Badge
                  key={skill}
                  variant="default"
                  className="text-xs py-0.5 px-2 cursor-move"
                  draggable
                  onDragStart={() => handleDragStart(skill, index)}
                  onDragEnd={handleDragEnd}
                >
                  {skill.replace(/_/g, ' ')}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-1 hover:text-red-300"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
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
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2 bg-gray-50">
          {Object.entries(filteredSkills).length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No available skills</p>
          ) : (
            Object.entries(filteredSkills).map(([category, skills]) => (
              <div key={category}>
                <div className="text-xs font-semibold text-gray-500 mb-1">{category}</div>
                <div className="flex flex-wrap gap-1">
                  {skills.map(skill => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="text-xs py-0 px-1.5 cursor-pointer hover:bg-blue-100"
                      onClick={() => !agentSkills.includes(skill) && setAgentSkills([...agentSkills, skill])}
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

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}