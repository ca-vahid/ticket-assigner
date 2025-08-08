import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiService } from '@/services/api'

export interface Decision {
  id: string;
  ticketId: string;
  ticketSubject: string;
  type: 'AUTO_ASSIGNED' | 'SUGGESTED' | 'MANUAL_OVERRIDE';
  score: number;
  scoreBreakdown?: any;
  agentId: string;
  alternatives?: any[];
  createdAt: string;
  updatedAt: string;
}

export function useAssignments(params?: { limit?: number; ticketId?: string; agentId?: string }) {
  const queryClient = useQueryClient()

  const assignmentHistory = useQuery({
    queryKey: ['assignments', 'history', params],
    queryFn: async () => {
      const response = await apiService.getAssignmentHistory(params)
      return response.data as Decision[]
    },
  })

  const assignTicket = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiService.assignTicket(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  const provideFeedback = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiService.provideFeedback(data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  return {
    assignmentHistory,
    assignTicket,
    provideFeedback,
  }
}

export function useAssignmentStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['assignment-stats'],
    queryFn: async () => {
      const response = await apiService.getAssignmentHistory({ limit: 100 })
      const assignments = response.data as Decision[]
      
      if (!assignments || assignments.length === 0) {
        return {
          totalAssignments: 0,
          pendingReview: 0,
          autoAssigned: 0,
          avgScore: 0,
          successRate: 0
        }
      }
      
      const totalAssignments = assignments.length
      const autoAssigned = assignments.filter(a => a.type === 'AUTO_ASSIGNED').length
      const pendingReview = assignments.filter(a => a.type === 'SUGGESTED').length
      const avgScore = assignments.reduce((acc, a) => acc + (a.score || 0), 0) / totalAssignments
      
      return {
        totalAssignments,
        pendingReview,
        autoAssigned,
        avgScore: Math.round(avgScore * 100),
        successRate: totalAssignments > 0 ? Math.round((autoAssigned / totalAssignments) * 100) : 0
      }
    },
  })

  return {
    stats: data || {
      totalAssignments: 0,
      pendingReview: 0,
      autoAssigned: 0,
      avgScore: 0,
      successRate: 0
    },
    loading: isLoading
  }
}