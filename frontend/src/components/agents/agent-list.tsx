import { User, Circle, CheckCircle, XCircle, TicketIcon, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isAvailable: boolean;
  level: string;
  skills: string[];
  currentTicketCount: number;
  weightedTicketCount?: number;
  ticketWorkloadBreakdown?: {
    fresh: number;
    recent: number;
    stale: number;
    abandoned: number;
  };
  isPto?: boolean;
  currentLeaveType?: string;
  ptoStartDate?: string;
  ptoEndDate?: string;
}

interface AgentListProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
  loading?: boolean;
  ticketAgeWeights?: {
    fresh: number;
    recent: number;
    stale: number;
    old: number;
  };
}

export function AgentList({ 
  agents, 
  selectedAgent, 
  onSelectAgent, 
  loading,
  ticketAgeWeights = { fresh: 2.0, recent: 1.2, stale: 0.5, old: 0.1 }
}: AgentListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-2 bg-gray-100 rounded animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-1"></div>
            <div className="h-2 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No agents found
      </div>
    );
  }

  return (
    <div className="space-y-1 pb-2">
      {agents.map((agent) => (
        <div
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={cn(
            "p-2 rounded-md border cursor-pointer transition-all hover:shadow-sm",
            selectedAgent?.id === agent.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          {/* Compact Header Row */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="h-3 w-3 text-gray-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {agent.firstName} {agent.lastName}
                </div>
              </div>
              {agent.isPto ? (
                <Calendar className="h-3 w-3 text-orange-500 flex-shrink-0" title={`On ${agent.currentLeaveType || 'PTO'}`} />
              ) : agent.isAvailable ? (
                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
              )}
            </div>
          </div>

          {/* Email and Level in same row */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-gray-500 truncate">{agent.email}</span>
            <div className="flex items-center gap-1">
              {agent.isPto && (
                <Badge variant="secondary" className="text-xs py-0 px-1 bg-orange-100 text-orange-700">
                  {agent.currentLeaveType || 'PTO'}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs py-0 px-1">
                {agent.level}
              </Badge>
            </div>
          </div>

          {/* Compact Ticket Stats */}
          <div className="bg-gray-50 rounded p-1.5 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-gray-600 flex items-center gap-1">
                <TicketIcon className="h-3 w-3" />
                Tickets
              </span>
              <div className="font-semibold">
                {agent.currentTicketCount || 0}
                {(() => {
                  // Calculate weighted count from breakdown if available
                  if (agent.ticketWorkloadBreakdown) {
                    const breakdown = agent.ticketWorkloadBreakdown;
                    const weighted = 
                      (breakdown.fresh || 0) * ticketAgeWeights.fresh +
                      (breakdown.recent || 0) * ticketAgeWeights.recent +
                      (breakdown.stale || 0) * ticketAgeWeights.stale +
                      (breakdown.abandoned || 0) * ticketAgeWeights.old;
                    
                    if (weighted > 0 && weighted !== agent.currentTicketCount) {
                      return (
                        <span className="text-orange-600 ml-1">
                          ({weighted.toFixed(1)}w)
                        </span>
                      );
                    }
                  } else if (agent.weightedTicketCount && Number(agent.weightedTicketCount) !== agent.currentTicketCount) {
                    // Fallback to stored weighted count if no breakdown
                    return (
                      <span className="text-orange-600 ml-1">
                        ({Number(agent.weightedTicketCount).toFixed(1)}w)
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            
            {/* Mini breakdown */}
            {agent.ticketWorkloadBreakdown && (agent.ticketWorkloadBreakdown.fresh > 0 || 
              agent.ticketWorkloadBreakdown.recent > 0 || 
              agent.ticketWorkloadBreakdown.stale > 0) && (
              <div className="flex gap-2 text-xs">
                {agent.ticketWorkloadBreakdown.fresh > 0 && (
                  <span className="text-red-600">{agent.ticketWorkloadBreakdown.fresh}F</span>
                )}
                {agent.ticketWorkloadBreakdown.recent > 0 && (
                  <span className="text-orange-600">{agent.ticketWorkloadBreakdown.recent}R</span>
                )}
                {agent.ticketWorkloadBreakdown.stale > 0 && (
                  <span className="text-yellow-600">{agent.ticketWorkloadBreakdown.stale}S</span>
                )}
                {agent.ticketWorkloadBreakdown.abandoned > 0 && (
                  <span className="text-gray-500">{agent.ticketWorkloadBreakdown.abandoned}O</span>
                )}
              </div>
            )}
            
            {/* Mini workload bar */}
            {(agent.currentTicketCount > 0) && (
              <div className="mt-1">
                <div className="w-full bg-gray-200 rounded-full h-1">
                  {(() => {
                    // Calculate weighted count for bar
                    let weightedCount = agent.currentTicketCount;
                    if (agent.ticketWorkloadBreakdown) {
                      const breakdown = agent.ticketWorkloadBreakdown;
                      weightedCount = 
                        (breakdown.fresh || 0) * ticketAgeWeights.fresh +
                        (breakdown.recent || 0) * ticketAgeWeights.recent +
                        (breakdown.stale || 0) * ticketAgeWeights.stale +
                        (breakdown.abandoned || 0) * ticketAgeWeights.old;
                    } else if (agent.weightedTicketCount) {
                      weightedCount = Number(agent.weightedTicketCount);
                    }
                    
                    return (
                      <div 
                        className={`h-1 rounded-full transition-all ${
                          weightedCount > 8 ? 'bg-red-500' :
                          weightedCount > 5 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ 
                          width: `${Math.min(
                            (weightedCount / Math.max(10, Math.ceil(weightedCount * 1.2))) * 100, 
                            100
                          )}%` 
                        }}
                      />
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Top 3 Skills - Very Compact (Including auto-detected) */}
          {agent.skills && agent.skills.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {agent.skills.slice(0, 3).map((skill, index) => (
                <Badge
                  key={index}
                  variant={agent.autoDetectedSkills?.includes(skill) ? "default" : "secondary"}
                  className="text-xs py-0 px-1"
                >
                  {skill.replace(/_/g, ' ')}
                </Badge>
              ))}
              {agent.skills.length > 3 && (
                <Badge
                  variant="secondary"
                  className="text-xs py-0 px-1"
                >
                  +{agent.skills.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}