import { User, Circle, CheckCircle, XCircle } from 'lucide-react';
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
}

interface AgentListProps {
  agents: Agent[];
  selectedAgent: Agent | null;
  onSelectAgent: (agent: Agent) => void;
  loading?: boolean;
}

export function AgentList({ agents, selectedAgent, onSelectAgent, loading }: AgentListProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
    <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
      {agents.map((agent) => (
        <div
          key={agent.id}
          onClick={() => onSelectAgent(agent)}
          className={cn(
            "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
            selectedAgent?.id === agent.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300 bg-white"
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <div className="font-medium text-sm">
                  {agent.firstName} {agent.lastName}
                </div>
                <div className="text-xs text-gray-500">{agent.email}</div>
              </div>
            </div>
            {agent.isAvailable ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">
              {agent.level}
            </Badge>
            <span className="text-xs text-gray-500">
              {agent.currentTicketCount} active tickets
            </span>
          </div>

          {agent.skills && agent.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.skills.slice(0, 3).map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs py-0 px-1"
                >
                  {skill}
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