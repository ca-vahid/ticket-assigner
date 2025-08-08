import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '@/services/api'

export interface Agent {
  id: string;
  freshserviceId: string;
  firstName: string;
  lastName: string;
  email: string;
  isAvailable: boolean;
  level: 'L1' | 'L2' | 'L3';
  skills: string[];
  currentTicketCount: number;
  totalAssignments?: number;
}

export function useAgents() {
  const queryClient = useQueryClient();

  const { data: agents, isLoading: loading, error } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await apiService.getAgents()
      return response.data as Agent[]
    },
  })

  const syncAgentsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiService.syncAgents()
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  const updateAgentMutation = useMutation({
    mutationFn: async ({ agentId, updates }: { agentId: string; updates: Partial<Agent> }) => {
      const response = await apiService.updateAgent(agentId, updates)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] })
    }
  })

  const getAgentAvailability = async (agentId: string) => {
    const response = await apiService.getAgentAvailability(agentId)
    return response.data
  }

  return {
    agents: agents || [],
    loading,
    error: error as Error | null,
    refreshAgents: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
    syncAgents: syncAgentsMutation.mutate,
    updateAgent: (agentId: string, updates: Partial<Agent>) => 
      updateAgentMutation.mutate({ agentId, updates }),
    getAgentAvailability,
  }
}