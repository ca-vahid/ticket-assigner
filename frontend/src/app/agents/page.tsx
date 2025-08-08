'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AgentList } from '@/components/agents/agent-list';
import { AgentDetail } from '@/components/agents/agent-detail';
import { SkillManager } from '@/components/agents/skill-manager';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Users, Upload } from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';

export default function AgentsPage() {
  const { agents, loading, error, refreshAgents, syncAgents, updateAgent } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAgents();
      await refreshAgents();
    } finally {
      setSyncing(false);
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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Agent Management</h2>
          <p className="text-muted-foreground">
            Manage agent skills, availability, and workload
          </p>
        </div>

        {/* Actions Bar */}
        <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                type="text"
                placeholder="Search agents or skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {syncing ? 'Syncing...' : 'Sync from Freshservice'}
            </Button>
            <Button
              onClick={refreshAgents}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent List */}
          <div className="lg:col-span-1">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Agents</h2>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Users className="h-4 w-4" />
                  {filteredAgents?.length || 0} agents
                </div>
              </div>
              <AgentList
                agents={filteredAgents}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                loading={loading}
              />
            </Card>
          </div>

          {/* Agent Details & Skill Management */}
          <div className="lg:col-span-2">
            {selectedAgent ? (
              <div className="space-y-6">
                <AgentDetail
                  agent={selectedAgent}
                  onUpdate={(updates) => handleAgentUpdate(selectedAgent.id, updates)}
                />
                <SkillManager
                  agent={selectedAgent}
                  onSkillsUpdate={(skills) => handleAgentUpdate(selectedAgent.id, { skills })}
                />
              </div>
            ) : (
              <Card className="p-12">
                <div className="text-center text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Select an agent to view details and manage skills</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}