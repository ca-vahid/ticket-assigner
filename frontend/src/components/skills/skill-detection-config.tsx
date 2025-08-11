import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Settings,
  Tag,
  Users,
  TrendingUp,
  Brain,
  Save,
  AlertCircle
} from 'lucide-react';

interface SkillDetectionConfigProps {
  configs: any[];
  onUpdate: () => void;
}

export function SkillDetectionConfig({ configs, onUpdate }: SkillDetectionConfigProps) {
  const [editedConfigs, setEditedConfigs] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const getConfigForMethod = (method: string) => {
    return configs.find(c => c.method === method) || {
      method,
      enabled: false,
      settings: getDefaultSettings(method)
    };
  };

  const getDefaultSettings = (method: string) => {
    switch (method) {
      case 'CATEGORY_BASED':
        return {
          minimumTickets: 5,
          lookbackTickets: 1000,
          includeComplexity: true
        };
      case 'GROUP_MEMBERSHIP':
        return {
          groupSkillMappings: {}
        };
      case 'RESOLUTION_PATTERNS':
        return {
          frequencyThreshold: 10
        };
      case 'TEXT_ANALYSIS_LLM':
        return {
          llmModel: 'gpt-4',
          batchSize: 50
        };
      default:
        return {};
    }
  };

  const updateConfig = (method: string, field: string, value: any) => {
    setEditedConfigs(prev => ({
      ...prev,
      [method]: {
        ...(prev[method] || getConfigForMethod(method)),
        [field]: value
      }
    }));
  };

  const updateSettings = (method: string, field: string, value: any) => {
    setEditedConfigs(prev => ({
      ...prev,
      [method]: {
        ...(prev[method] || getConfigForMethod(method)),
        settings: {
          ...(prev[method]?.settings || getConfigForMethod(method).settings),
          [field]: value
        }
      }
    }));
  };

  const saveConfig = async (method: string) => {
    setSaving(prev => ({ ...prev, [method]: true }));
    
    const config = editedConfigs[method] || getConfigForMethod(method);
    
    try {
      const response = await fetch(
        `http://localhost:3000/api/skills/config/${config.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        }
      );
      
      if (response.ok) {
        setEditedConfigs(prev => {
          const updated = { ...prev };
          delete updated[method];
          return updated;
        });
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(prev => ({ ...prev, [method]: false }));
    }
  };

  const hasChanges = (method: string) => {
    return !!editedConfigs[method];
  };

  const getIcon = (method: string) => {
    switch (method) {
      case 'CATEGORY_BASED':
        return <Tag className="h-5 w-5" />;
      case 'GROUP_MEMBERSHIP':
        return <Users className="h-5 w-5" />;
      case 'RESOLUTION_PATTERNS':
        return <TrendingUp className="h-5 w-5" />;
      case 'TEXT_ANALYSIS_LLM':
        return <Brain className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  const renderCategoryBasedSettings = (method: string) => {
    const config = editedConfigs[method] || getConfigForMethod(method);
    const settings = config.settings || {};

    return (
      <div className="space-y-4">
        <div>
          <Label>Minimum Tickets Required</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider
              value={[settings.minimumTickets || 5]}
              onValueChange={([value]) => updateSettings(method, 'minimumTickets', value)}
              min={1}
              max={20}
              step={1}
              className="flex-1"
            />
            <span className="w-12 text-sm font-medium">
              {settings.minimumTickets || 5}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Minimum number of tickets in a category to detect as a skill
          </p>
        </div>

        <div>
          <Label>Lookback Tickets</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider
              value={[settings.lookbackTickets || 1000]}
              onValueChange={([value]) => updateSettings(method, 'lookbackTickets', value)}
              min={100}
              max={5000}
              step={100}
              className="flex-1"
            />
            <span className="w-16 text-sm font-medium">
              {settings.lookbackTickets || 1000}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Number of recent tickets to analyze per agent
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Include Complexity</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Weight skills by ticket priority and complexity
            </p>
          </div>
          <Switch
            checked={settings.includeComplexity !== false}
            onCheckedChange={(checked) => updateSettings(method, 'includeComplexity', checked)}
          />
        </div>
      </div>
    );
  };

  const renderGroupMembershipSettings = (method: string) => {
    const config = editedConfigs[method] || getConfigForMethod(method);
    const settings = config.settings || {};
    const mappings = settings.groupSkillMappings || {
      'Network Team': ['network', 'vpn', 'firewall'],
      'Security Team': ['security', 'access_control'],
      'Database Team': ['database', 'sql']
    };

    return (
      <div className="space-y-4">
        <div>
          <Label>Group to Skill Mappings</Label>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Define which skills to assign based on group membership
          </p>
          
          {Object.entries(mappings).map(([group, skills]) => (
            <div key={group} className="mb-3 p-3 border rounded">
              <div className="font-medium text-sm mb-2">{group}</div>
              <div className="flex flex-wrap gap-1">
                {(skills as string[]).map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTextAnalysisSettings = (method: string) => {
    const config = editedConfigs[method] || getConfigForMethod(method);
    const settings = config.settings || {};

    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            LLM-based skill detection analyzes ticket text to identify skills.
            This feature requires API credits and may take longer to process.
          </AlertDescription>
        </Alert>

        <div>
          <Label>LLM Model</Label>
          <Input
            value={settings.llmModel || 'gpt-4'}
            onChange={(e) => updateSettings(method, 'llmModel', e.target.value)}
            className="mt-2"
          />
        </div>

        <div>
          <Label>Batch Size</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider
              value={[settings.batchSize || 50]}
              onValueChange={([value]) => updateSettings(method, 'batchSize', value)}
              min={10}
              max={100}
              step={10}
              className="flex-1"
            />
            <span className="w-12 text-sm font-medium">
              {settings.batchSize || 50}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Number of tickets to analyze in each LLM request
          </p>
        </div>
      </div>
    );
  };

  const methods = [
    {
      key: 'CATEGORY_BASED',
      title: 'Category-Based Detection',
      description: 'Detect skills from ticket categories and custom fields',
      renderSettings: renderCategoryBasedSettings
    },
    {
      key: 'GROUP_MEMBERSHIP',
      title: 'Group Membership',
      description: 'Assign skills based on team/group membership',
      renderSettings: renderGroupMembershipSettings
    },
    {
      key: 'RESOLUTION_PATTERNS',
      title: 'Resolution Patterns',
      description: 'Analyze ticket resolution patterns to identify expertise',
      renderSettings: () => (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This detection method is under development
          </AlertDescription>
        </Alert>
      )
    },
    {
      key: 'TEXT_ANALYSIS_LLM',
      title: 'AI Text Analysis',
      description: 'Use LLM to analyze ticket text and extract skills',
      renderSettings: renderTextAnalysisSettings
    }
  ];

  return (
    <div className="space-y-4">
      {methods.map(({ key, title, description, renderSettings }) => {
        const config = editedConfigs[key] || getConfigForMethod(key);
        
        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {getIcon(key)}
                  <div>
                    <CardTitle className="text-lg">{title}</CardTitle>
                    <CardDescription className="mt-1">
                      {description}
                    </CardDescription>
                    {config.lastRunAt && (
                      <div className="text-xs text-muted-foreground mt-2">
                        Last run: {new Date(config.lastRunAt).toLocaleString()}
                        {config.lastRunStatus && (
                          <Badge 
                            variant={config.lastRunStatus === 'SUCCESS' ? 'default' : 'destructive'}
                            className="ml-2"
                          >
                            {config.lastRunStatus}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => updateConfig(key, 'enabled', checked)}
                  />
                  {hasChanges(key) && (
                    <Button
                      size="sm"
                      onClick={() => saveConfig(key)}
                      disabled={saving[key]}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            {config.enabled && (
              <CardContent>
                {renderSettings(key)}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}