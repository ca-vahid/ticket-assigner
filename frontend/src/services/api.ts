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

  // Scoring endpoints
  async getScoringWeights() {
    return this.api.get('/api/scoring/weights')
  }

  async updateScoringWeights(weights: any) {
    return this.api.put('/api/scoring/weights', weights)
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
}

export const apiService = new ApiService()