import { useState, useRef } from 'react';
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
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold">Skill Management</h3>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? 'Saving...' : 'Save Skills'}
        </Button>
      </div>

      {/* Agent's Current Skills */}
      <div className="mb-6">
        <Label className="text-sm font-medium text-gray-700 mb-2 block">
          Current Skills ({agentSkills.length})
        </Label>
        <div
          className={cn(
            "min-h-[80px] p-4 border-2 border-dashed rounded-lg transition-colors",
            draggedSkill && draggedIndex === null ? "border-blue-400 bg-blue-50" : "border-gray-300"
          )}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e)}
        >
          {agentSkills.length === 0 ? (
            <div className="text-center text-gray-400 py-4">
              <Tag className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Drag skills here or click on them to add</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agentSkills.map((skill, index) => (
                <div
                  key={skill}
                  draggable
                  onDragStart={() => handleDragStart(skill, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className="group"
                >
                  <Badge
                    variant="default"
                    className="cursor-move flex items-center gap-1 px-3 py-1.5 hover:shadow-md transition-all"
                  >
                    <GripVertical className="h-3 w-3 opacity-50" />
                    {skill.replace(/_/g, ' ')}
                    <button
                      onClick={() => handleRemoveSkill(skill)}
                      className="ml-1 opacity-60 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Available Skills */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium text-gray-700">Available Skills</Label>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search skills..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Object.entries(filteredSkills).map(([category, skills]) => (
            <div key={category}>
              <div className="text-xs font-semibold text-gray-500 mb-2">{category}</div>
              <div className="flex flex-wrap gap-2">
                {skills.map(skill => (
                  <Badge
                    key={skill}
                    variant="outline"
                    draggable
                    onDragStart={() => handleDragStart(skill)}
                    onDragEnd={handleDragEnd}
                    onClick={() => !agentSkills.includes(skill) && setAgentSkills([...agentSkills, skill])}
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    {skill.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Add Custom Skill */}
        <div className="mt-4 pt-4 border-t">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">Add Custom Skill</Label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter custom skill..."
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddCustomSkill()}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleAddCustomSkill}
              disabled={!customSkill}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={className}>{children}</label>;
}