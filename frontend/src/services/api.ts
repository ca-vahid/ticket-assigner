import axios, { AxiosInstance } from 'axios'

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor for auth
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized
          localStorage.removeItem('authToken')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // Assignment endpoints
  async assignTicket(data: any) {
    return this.api.post('/api/assignment/assign', data)
  }

  async getAssignmentHistory(params?: any) {
    return this.api.get('/api/assignment/history', { params })
  }

  async provideFeedback(data: any) {
    return this.api.post('/api/assignment/feedback', data)
  }

  // Agent endpoints
  async getAgents() {
    return this.api.get('/api/agents')
  }

  async getAgentAvailability(agentId: string) {
    return this.api.get(`/api/eligibility/agent/${agentId}/availability`)
  }

  async updateAgent(agentId: string, updates: any) {
    return this.api.put(`/api/agents/${agentId}`, updates)
  }

  async syncAgents() {
    return this.api.post('/api/admin/sync/agents')
  }

  async recalculateWorkloads() {
    return this.api.post('/api/admin/sync/recalculate-workloads')
  }

  async getSyncTimestamps() {
    return this.api.get('/api/admin/sync/timestamps')
  }

  // Scoring endpoints
  async getScoringWeights() {
    return this.api.get('/api/scoring/weights')
  }

  async updateScoringWeights(weights: any) {
    return this.api.put('/api/scoring/weights', weights)
  }

  async getTicketAgeWeights() {
    return this.api.get('/api/scoring/ticket-age-weights')
  }

  async updateTicketAgeWeights(weights: any) {
    return this.api.put('/api/scoring/ticket-age-weights', weights)
  }

  async getAvailableSkills() {
    return this.api.get<string[]>('/api/scoring/available-skills')
  }

  async getAvailableLocations() {
    return this.api.get<{ id: string; name: string; timezone?: string }[]>('/api/scoring/available-locations')
  }

  async testScoringScenario(scenario: {
    skills: string[];
    level: string;
    locationId?: string;
    isVIP: boolean;
  }) {
    return this.api.post('/api/scoring/test-scenario', scenario)
  }

  async testAssignmentScenario(scenario: {
    skills: string[];
    level: string;
    locationId?: string;
    isVIP: boolean;
    categoryId?: string;
  }) {
    return this.api.post('/api/assignment/test-scenario', scenario)
  }

  // Eligibility endpoints
  async checkEligibility(context: any) {
    return this.api.post('/api/eligibility/check', context)
  }

  // Settings endpoints
  async getSettings() {
    return this.api.get('/api/settings')
  }

  async updateSettings(settings: any) {
    return this.api.put('/api/settings', settings)
  }
  
  async getAutoAssignStatus() {
    return this.api.get('/api/settings/auto-assign')
  }
  
  async updateAutoAssignStatus(enabled: boolean) {
    return this.api.put('/api/settings/auto-assign', { enabled })
  }

  // Delete endpoints
  async deleteOldAssignments(days: number) {
    return this.api.delete(`/api/assignment/history/old?days=${days}`)
  }

  async deleteAllAssignments() {
    return this.api.delete('/api/assignment/history/all')
  }

  async deleteAssignment(id: string) {
    return this.api.delete(`/api/assignment/history/${id}`)
  }

  async deleteAgent(id: string) {
    return this.api.delete(`/api/agents/${id}`)
  }

  async deleteInactiveAgents() {
    return this.api.delete('/api/agents/inactive/all')
  }

  async clearAgentSkills(agentId: string) {
    return this.api.put(`/api/agents/${agentId}/clear-skills`, {})
  }

  async clearAllDetectedSkills() {
    return this.api.delete('/api/agents/skills/detected')
  }

  // Location endpoints
  async getLocations() {
    return this.api.get<any[]>('/api/locations')
  }

  async getLocation(id: string) {
    return this.api.get(`/api/locations/${id}`)
  }

  async syncLocations() {
    return this.api.post('/api/locations/sync', {})
  }

  async getLocationStats() {
    return this.api.get('/api/locations/stats/summary')
  }

  async updateLocation(id: string, data: {
    name?: string
    timezone?: string
    country?: string
    city?: string
    metadata?: any
  }) {
    return this.api.put(`/api/locations/${id}`, data)
  }

  async deleteLocation(id: string) {
    return this.api.delete(`/api/locations/${id}`)
  }

  async deleteEmptyLocations() {
    return this.api.delete('/api/locations/cleanup/empty')
  }

  async getLocationAgents(locationId: string) {
    return this.api.get(`/api/locations/${locationId}/agents`)
  }

  // Audit log endpoints
  async createAuditLog(data: {
    action: string
    type: 'delete' | 'create' | 'update' | 'reset' | 'export' | 'import' | 'sync' | 'settings'
    user: string
    entityType?: string
    entityId?: string
    metadata?: Record<string, any>
  }) {
    return this.api.post('/api/audit/log', data)
  }

  async getAuditLogs(params?: {
    limit?: number
    offset?: number
    type?: string
    user?: string
    entityType?: string
    startDate?: string
    endDate?: string
  }) {
    return this.api.get('/api/audit', { params })
  }

  async clearOldAuditLogs(days: number) {
    return this.api.delete(`/api/audit/old?days=${days}`)
  }

  // Eligibility rules endpoints
  async getEligibilityRules() {
    return this.api.get('/api/settings/eligibility-rules')
  }

  async updateEligibilityRules(rules: any[]) {
    return this.api.put('/api/settings/eligibility-rules', rules)
  }
}

export const apiService = new ApiService()