'use client';

import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AgentList } from '@/components/agents/agent-list';
import { AgentDetail } from '@/components/agents/agent-detail';
import { SkillManager } from '@/components/agents/skill-manager';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Users, Upload, TicketIcon, Brain } from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';

export default function AgentsPage() {
  const { agents, loading, error, refreshAgents, syncAgents, updateAgent } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAgents();
      await refreshAgents();
    } finally {
      setSyncing(false);
    }
  };

  const handleDetectSkills = async (agentId?: string) => {
    try {
      const url = agentId 
        ? `http://localhost:3001/api/skills/detection/run?agentId=${agentId}`
        : 'http://localhost:3001/api/skills/detection/run';
      
      const response = await fetch(url, { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        console.log(`Skills detected: ${result.skillsDetected}`);
        await refreshAgents();
      }
    } catch (error) {
      console.error('Failed to detect skills:', error);
    }
  };

  const handleSyncTicketCounts = async () => {
    setSyncingTickets(true);
    try {
      const response = await fetch('http://localhost:3001/api/admin/sync/ticket-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.success) {
        console.log(data.message);
        await refreshAgents();
      }
    } catch (error) {
      console.error('Failed to sync ticket counts:', error);
    } finally {
      setSyncingTickets(false);
    }
  };

  const handleAgentUpdate = async (agentId: string, updates: any) => {
    await updateAgent(agentId, updates);
    await refreshAgents();
  };

  const filteredAgents = agents?.filter(agent => 
    agent.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Agent Management</h2>
            <p className="text-sm text-muted-foreground">
              {agents?.length || 0} total agents • {agents?.filter(a => a.isAvailable).length || 0} available
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-1" />
              {syncing ? 'Syncing...' : 'Sync Agents'}
            </Button>
            <Button
              onClick={handleSyncTicketCounts}
              disabled={syncingTickets}
              variant="outline"
              size="sm"
            >
              <TicketIcon className="h-4 w-4 mr-1" />
              {syncingTickets ? 'Updating...' : 'Update Tickets'}
            </Button>
            <Button
              onClick={() => handleDetectSkills()}
              variant="outline"
              size="sm"
            >
              <Brain className="h-4 w-4 mr-1" />
              Detect Skills
            </Button>
            <Button
              onClick={refreshAgents}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            type="text"
            placeholder="Search agents or skills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Agent List with its own scroll */}
          <div className="col-span-12 lg:col-span-4">
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">Agents ({filteredAgents?.length || 0})</h3>
                <span className="text-xs text-gray-500">
                  Click to select
                </span>
              </div>
              
              {/* Independent Scrollable Container for Agent List */}
              <div style={{ 
                maxHeight: '70vh', 
                overflowY: 'auto',
                overflowX: 'hidden'
              }}>
                <AgentList
                  agents={filteredAgents}
                  selectedAgent={selectedAgent}
                  onSelectAgent={setSelectedAgent}
                  loading={loading}
                />
              </div>
            </Card>
          </div>

          {/* Right Panel - Agent Details & Skills */}
          <div className="col-span-12 lg:col-span-8">
            {selectedAgent ? (
              <div className="space-y-4">
                {/* Compact Agent Header */}
                <Card className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                        {selectedAgent.firstName[0]}{selectedAgent.lastName[0]}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">
                          {selectedAgent.firstName} {selectedAgent.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">{selectedAgent.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        selectedAgent.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {selectedAgent.isAvailable ? 'Available' : 'Unavailable'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">Level {selectedAgent.level}</p>
                    </div>
                  </div>
                </Card>

                {/* Two Column Layout for Workload and Skills */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Workload Analysis - Left */}
                  <Card className="p-4">
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <TicketIcon className="h-4 w-4" />
                      Workload Analysis
                    </h4>
                    
                    {/* Compact Stats */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="text-center p-2 bg-blue-50 rounded">
                        <div className="text-xl font-bold text-blue-900">
                          {selectedAgent.currentTicketCount || 0}
                        </div>
                        <div className="text-xs text-gray-600">Raw</div>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded">
                        <div className="text-xl font-bold text-orange-600">
                          {selectedAgent.weightedTicketCount ? Number(selectedAgent.weightedTicketCount).toFixed(1) : selectedAgent.currentTicketCount}
                        </div>
                        <div className="text-xs text-gray-600">Weighted</div>
                      </div>
                    </div>

                    {/* Ticket Breakdown */}
                    {selectedAgent.ticketWorkloadBreakdown && (
                      <div className="space-y-2">
                        {selectedAgent.ticketWorkloadBreakdown.fresh > 0 && (
                          <div className="flex justify-between items-center p-2 bg-red-50 rounded text-xs">
                            <span className="text-red-700 font-medium">Fresh (0-1d)</span>
                            <span className="font-mono text-red-600">
                              {selectedAgent.ticketWorkloadBreakdown.fresh} × 2.0
                            </span>
                          </div>
                        )}
                        {selectedAgent.ticketWorkloadBreakdown.recent > 0 && (
                          <div className="flex justify-between items-center p-2 bg-orange-50 rounded text-xs">
                            <span className="text-orange-700 font-medium">Recent (2-5d)</span>
                            <span className="font-mono text-orange-600">
                              {selectedAgent.ticketWorkloadBreakdown.recent} × 1.2
                            </span>
                          </div>
                        )}
                        {selectedAgent.ticketWorkloadBreakdown.stale > 0 && (
                          <div className="flex justify-between items-center p-2 bg-yellow-50 rounded text-xs">
                            <span className="text-yellow-700 font-medium">Stale (6-14d)</span>
                            <span className="font-mono text-yellow-600">
                              {selectedAgent.ticketWorkloadBreakdown.stale} × 0.5
                            </span>
                          </div>
                        )}
                        {selectedAgent.ticketWorkloadBreakdown.abandoned > 0 && (
                          <div className="flex justify-between items-center p-2 bg-gray-50 rounded text-xs">
                            <span className="text-gray-700 font-medium">Old (15+d)</span>
                            <span className="font-mono text-gray-600">
                              {selectedAgent.ticketWorkloadBreakdown.abandoned} × 0.1
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>

                  {/* Skills Management - Right */}
                  <SkillManager
                    key={selectedAgent.id}
                    agent={selectedAgent}
                    onSkillsUpdate={(skills) => handleAgentUpdate(selectedAgent.id, { skills })}
                  />
                </div>

                {/* Additional Details Below */}
                <Card className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Total Assignments</p>
                      <p className="font-semibold">{selectedAgent.totalAssignments || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Max Concurrent</p>
                      <p className="font-semibold">{selectedAgent.maxConcurrentTickets || 10}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Last Assignment</p>
                      <p className="font-semibold">
                        {selectedAgent.lastAssignmentDate 
                          ? new Date(selectedAgent.lastAssignmentDate).toLocaleDateString()
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an agent to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}