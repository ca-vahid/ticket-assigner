'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout/main-layout';
import { AgentList } from '@/components/agents/agent-list';
import { AgentDetail } from '@/components/agents/agent-detail';
import { SkillManager } from '@/components/agents/skill-manager';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { RefreshCw, Search, Users, Upload, TicketIcon, Brain, UserX, UserCheck, ExternalLink } from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';

export default function AgentsPage() {
  const router = useRouter();
  const { agents, loading, error, refreshAgents, syncAgents, updateAgent } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [syncing, setSyncing] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [detectingSkills, setDetectingSkills] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Auto-update selectedAgent when agents data changes
  useEffect(() => {
    if (selectedAgent && agents) {
      const updatedAgent = agents.find(a => a.id === selectedAgent.id);
      if (updatedAgent && JSON.stringify(updatedAgent) !== JSON.stringify(selectedAgent)) {
        setSelectedAgent(updatedAgent);
      }
    }
  }, [agents]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAgents();
      await refreshAgents();
    } finally {
      setSyncing(false);
    }
  };

  const handleDetectSkills = async (agentId: string, agentName: string) => {
    console.log('Detecting skills for:', { agentId, agentName });
    
    if (!agentId) {
      setDetectionResult({
        agentId: 'unknown',
        agentName: agentName || 'Unknown',
        error: true,
        message: 'Agent ID is missing'
      });
      return;
    }
    
    setDetectingSkills(agentId);
    setDetectionResult(null);
    
    try {
      const response = await fetch('/api/skills/detect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const hasNewSkills = result.skillsDetected > 0;
        const hasPendingSkills = result.pendingSkillsCount > 0;
        const hasApprovedSkills = result.approvedSkillsCount > 0;
        const hasReAddedSkills = result.skillsReAdded > 0;
        const alreadyDetected = result.alreadyDetected;
        
        let message = '';
        if (hasNewSkills || hasReAddedSkills) {
          if (hasReAddedSkills && !hasPendingSkills) {
            message = `Re-added ${result.skillsDetected} previously removed skill(s) for ${agentName}.`;
          } else {
            message = `Successfully detected ${result.skillsDetected} skill(s) for ${agentName}.`;
          }
        } else if (hasPendingSkills) {
          message = `No new skills detected, but ${result.pendingSkillsCount} skill(s) are pending review for ${agentName}.`;
        } else if (alreadyDetected && hasApprovedSkills) {
          message = `Skills already detected and approved for ${agentName}. ${result.approvedSkillsCount} skill(s) are currently active.`;
        } else {
          message = `No skills detected for ${agentName}. This agent may not have enough resolved tickets (5+ required per category).`;
        }
        
        if (hasPendingSkills) {
          message += ' Go to Skills page to review pending skills.';
        }
        
        setDetectionResult({
          agentId,
          agentName,
          skillsDetected: result.skillsDetected || 0,
          pendingSkillsCount: result.pendingSkillsCount || 0,
          approvedSkillsCount: result.approvedSkillsCount || 0,
          alreadyDetected: result.alreadyDetected || false,
          message
        });
      } else {
        setDetectionResult({
          agentId,
          agentName,
          error: true,
          message: `Failed to detect skills for ${agentName}: ${result.errors?.join(', ') || 'Unknown error'}`
        });
      }
      
      // Force refresh agents data after detection
      await refreshAgents();
    } catch (error) {
      console.error('Failed to detect skills:', error);
      setDetectionResult({
        agentId,
        agentName,
        error: true,
        message: `Failed to detect skills for ${agentName}: Network error`
      });
    } finally {
      setDetectingSkills(null);
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

  const handleAgentUpdate = async (agentId: string, updates: any, skipConfirm = false) => {
    const performUpdate = async () => {
      await updateAgent(agentId, updates);
      // The useEffect will automatically update selectedAgent when agents data refreshes
      
      // If deactivating, switch to inactive tab to show the agent there
      if ('isAvailable' in updates && !updates.isAvailable) {
        setActiveTab('inactive');
      }
      // If activating, switch to active tab
      else if ('isAvailable' in updates && updates.isAvailable) {
        setActiveTab('active');
      }
    };

    // Add confirmation for status changes
    if (!skipConfirm && 'isAvailable' in updates) {
      const isActivating = updates.isAvailable;
      setConfirmDialog({
        open: true,
        title: isActivating ? 'Activate Agent' : 'Deactivate Agent',
        description: isActivating 
          ? `Are you sure you want to activate ${selectedAgent?.firstName} ${selectedAgent?.lastName}?\n\nThis agent will be eligible for ticket assignments.`
          : `Are you sure you want to deactivate ${selectedAgent?.firstName} ${selectedAgent?.lastName}?\n\nThis agent will NOT receive any new ticket assignments and will be moved to the Inactive tab.`,
        variant: isActivating ? 'default' : 'destructive',
        onConfirm: async () => {
          setConfirmDialog({ ...confirmDialog, open: false });
          await performUpdate();
        }
      });
      return;
    }
    
    // Add confirmation for level changes
    if (!skipConfirm && 'level' in updates && updates.level !== selectedAgent?.level) {
      setConfirmDialog({
        open: true,
        title: 'Change Agent Level',
        description: `Are you sure you want to change ${selectedAgent?.firstName} ${selectedAgent?.lastName}'s level from ${selectedAgent?.level} to ${updates.level}?\n\nThis may affect their ticket assignment priorities.`,
        variant: 'default',
        onConfirm: async () => {
          setConfirmDialog({ ...confirmDialog, open: false });
          await performUpdate();
        }
      });
      return;
    }
    
    await performUpdate();
  };

  const filteredAgents = agents?.filter(agent => 
    agent.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agent.skills?.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Separate active and inactive agents
  const activeAgents = filteredAgents?.filter(agent => agent.isAvailable !== false);
  const inactiveAgents = filteredAgents?.filter(agent => agent.isAvailable === false);

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Agent Management</h2>
            <p className="text-sm text-muted-foreground">
              {agents?.length || 0} total • {activeAgents?.length || 0} active • {inactiveAgents?.length || 0} inactive
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
              onClick={async () => {
                if (confirm('This will detect skills for ALL agents. This may take a while. Continue?')) {
                  setDetectingSkills('all');
                  setDetectionResult(null);
                  try {
                    const response = await fetch('/api/skills/detect', { 
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ runAll: true })
                    });
                    const result = await response.json();
                    
                    setDetectionResult({
                      agentName: 'All Agents',
                      skillsDetected: result.skillsDetected || 0,
                      message: `Processed ${result.agentsProcessed || 0} agents, detected ${result.skillsDetected || 0} new skills`
                    });
                  } catch (error) {
                    setDetectionResult({
                      agentName: 'All Agents',
                      error: true,
                      message: 'Failed to detect skills for all agents'
                    });
                  } finally {
                    setDetectingSkills(null);
                  }
                }
              }}
              disabled={detectingSkills === 'all'}
              variant="outline"
              size="sm"
            >
              <Brain className="h-4 w-4 mr-1" />
              {detectingSkills === 'all' ? 'Detecting...' : 'Detect All Skills'}
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

        {/* Detection Result Alert */}
        {detectionResult && (
          <div className={`p-3 rounded-lg border ${detectionResult.error ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}>
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 ${detectionResult.error ? 'text-red-600' : 'text-green-600'}`}>
                {detectionResult.error ? '✗' : '✓'}
              </div>
              <div className="flex-1">
                <div className={`font-medium ${detectionResult.error ? 'text-red-900' : 'text-green-900'}`}>
                  {detectionResult.agentName}
                </div>
                <div className={`text-sm ${detectionResult.error ? 'text-red-700' : 'text-green-700'}`}>
                  {detectionResult.message}
                  {/* Add link to review skills if skills were detected or pending */}
                  {((detectionResult.skillsDetected > 0 || detectionResult.pendingSkillsCount > 0) && !detectionResult.error) && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // Navigate to skills page with agent filter
                          // Store agent info in sessionStorage to filter on skills page
                          if (detectionResult.agentId && detectionResult.agentName) {
                            sessionStorage.setItem('skillsFilterAgent', JSON.stringify({
                              id: detectionResult.agentId,
                              name: detectionResult.agentName
                            }));
                          }
                          router.push('/skills');
                        }}
                        className="h-7 px-2 py-0 text-xs font-medium border-green-300 text-green-700 hover:bg-green-100"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Review {detectionResult.pendingSkillsCount || detectionResult.skillsDetected} Skill{(detectionResult.pendingSkillsCount || detectionResult.skillsDetected) > 1 ? 's' : ''}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDetectionResult(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Panel - Agent List with tabs - Made narrower */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="p-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-2">
                  <TabsTrigger value="active" className="text-xs">
                    <UserCheck className="h-3 w-3 mr-1" />
                    Active ({activeAgents?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="inactive" className="text-xs">
                    <UserX className="h-3 w-3 mr-1" />
                    Inactive ({inactiveAgents?.length || 0})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="active" className="mt-2">
                  <div style={{ 
                    maxHeight: '65vh', 
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}>
                    <AgentList
                      agents={activeAgents}
                      selectedAgent={selectedAgent}
                      onSelectAgent={setSelectedAgent}
                      loading={loading}
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="inactive" className="mt-2">
                  <div style={{ 
                    maxHeight: '65vh', 
                    overflowY: 'auto',
                    overflowX: 'hidden'
                  }}>
                    <AgentList
                      agents={inactiveAgents}
                      selectedAgent={selectedAgent}
                      onSelectAgent={setSelectedAgent}
                      loading={loading}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Right Panel - Agent Details & Skills - Made wider */}
          <div className="col-span-12 lg:col-span-9">
            {selectedAgent ? (
              <div className="space-y-4">
                {/* Compact Agent Header with Controls */}
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
                        {selectedAgent.location && (
                          <p className="text-xs text-gray-500">
                            {selectedAgent.location.name} • {selectedAgent.location.timezone}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      {/* Level Selector */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Level</label>
                        <select
                          value={selectedAgent.level}
                          onChange={(e) => handleAgentUpdate(selectedAgent.id, { level: e.target.value })}
                          className="px-2 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="L1">L1</option>
                          <option value="L2">L2</option>
                          <option value="L3">L3</option>
                        </select>
                      </div>
                      
                      {/* Availability Toggle */}
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-gray-500">Status</label>
                        <Button
                          size="sm"
                          variant={selectedAgent.isAvailable ? "default" : "destructive"}
                          onClick={() => handleAgentUpdate(selectedAgent.id, { isAvailable: !selectedAgent.isAvailable })}
                          className="h-8"
                        >
                          {selectedAgent.isAvailable ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Two Column Layout for Skills and Workload - SWITCHED ORDER */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Skills Management - Now on Left */}
                  <SkillManager
                    key={selectedAgent.id}
                    agent={selectedAgent}
                    onSkillsUpdate={(skills) => handleAgentUpdate(selectedAgent.id, { skills })}
                    onDetectSkills={handleDetectSkills}
                  />
                  
                  {/* Workload Analysis - Now on Right */}
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
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        confirmText={confirmDialog.variant === 'destructive' ? 'Deactivate' : 'Confirm'}
      />
    </MainLayout>
  );
}