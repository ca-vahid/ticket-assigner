import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  XCircle,
  User,
  Tag,
  ChevronDown,
  ChevronRight,
  Clock,
  UserCheck,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReviewedSkillsViewProps {
  type: 'approved' | 'rejected';
}

export function ReviewedSkillsView({ type }: ReviewedSkillsViewProps) {
  const [skills, setSkills] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSkills();
  }, [type]);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/skills/detected/${type}?_t=${timestamp}`, {
        cache: 'no-store'
      });
      const data = await response.json();
      setSkills(data);
      
      // Auto-expand if there are 3 or fewer agents
      const agentCount = Object.keys(data.byAgent || {}).length;
      if (agentCount > 0 && agentCount <= 3) {
        setExpandedAgents(new Set(Object.keys(data.byAgent)));
      }
    } catch (error) {
      console.error(`Failed to fetch ${type} skills:`, error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgentExpanded = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return '🟢';
    if (confidence >= 0.6) return '🟡';
    return '🔴';
  };

  const formatDate = (date: string) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-600">Loading {type} skills...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!skills || skills.total === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            {type === 'approved' ? (
              <CheckCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            ) : (
              <XCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            )}
            <p className="text-lg font-medium text-gray-600">
              No {type} skills yet
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Skills will appear here after they are {type}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const agents = Object.entries(skills.byAgent || {});
  const bgColor = type === 'approved' ? 'from-green-50 to-green-100' : 'from-red-50 to-red-100';
  const borderColor = type === 'approved' ? 'border-green-200' : 'border-red-200';
  const iconColor = type === 'approved' ? 'text-green-600' : 'text-red-600';
  const Icon = type === 'approved' ? CheckCircle : XCircle;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className={cn(`bg-gradient-to-r ${bgColor} ${borderColor}`)}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={cn("h-6 w-6", iconColor)} />
              <div>
                <span className="text-2xl font-bold">{skills.total}</span>
                <span className="ml-2 text-lg font-medium">{type} skills</span>
              </div>
            </div>
            
            <div className="flex gap-4">
              {skills.byMethod && Object.entries(skills.byMethod).map(([method, count]) => (
                <div key={method} className="text-center">
                  <div className="text-xs text-muted-foreground">{method.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-semibold">{count as number}</div>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadSkills}
              className="h-8"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="space-y-2">
        {agents.map(([agentId, agentData]: [string, any]) => {
          const isExpanded = expandedAgents.has(agentId);
          
          return (
            <Card key={agentId} className="transition-all duration-200">
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
                    
                    <User className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">{agentData.agentName}</span>
                    
                    <Badge variant="outline" className="text-xs">
                      {agentData.skills.length} skills
                    </Badge>
                  </div>
                  
                  {!isExpanded && (
                    <div className="flex items-center gap-2">
                      {agentData.skills.slice(0, 3).map((skill: any) => (
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
                    {agentData.skills.map((skill: any) => (
                      <div 
                        key={skill.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border",
                          type === 'approved' ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"
                        )}
                      >
                        <Icon className={cn("h-4 w-4", iconColor)} />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-gray-500" />
                            <span className="text-sm font-medium">
                              {skill.skillName.replace(/_/g, ' ')}
                            </span>
                            
                            <Badge variant="outline" className="text-xs">
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
                          
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(skill.reviewedAt)}
                            </div>
                            <div className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              {skill.reviewedBy || 'Admin'}
                            </div>
                            {type === 'rejected' && skill.rejectionReason && (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                {skill.rejectionReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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