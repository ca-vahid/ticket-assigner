'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { AgentList } from '@/components/agents/agent-list';
import { AgentDetail } from '@/components/agents/agent-detail';
import { SkillManager } from '@/components/agents/skill-manager';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SearchInput } from '@/components/ui/search-input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, Users, Upload, TicketIcon, Brain, UserX, UserCheck,
  Download, Filter, SortAsc, SortDesc, FileDown, Copy
} from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';
import { useDebounce, useLocalStorage } from '@/hooks/useOptimizedData';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { exportToCSV, exportToJSON, copyToClipboard } from '@/lib/export-utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SortConfig {
  field: 'name' | 'ticketCount' | 'skills' | 'level';
  direction: 'asc' | 'desc';
}

export default function AgentsPageV2() {
  const { agents, loading, error, refreshAgents, syncAgents, updateAgent } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [syncing, setSyncing] = useState(false);
  const [syncingTickets, setSyncingTickets] = useState(false);
  const [detectingSkills, setDetectingSkills] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<any>(null);
  const [sortConfig, setSortConfig] = useLocalStorage<SortConfig>('agents-sort', {
    field: 'name',
    direction: 'asc'
  });
  const [filterLevel, setFilterLevel] = useState<string | null>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

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

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'r',
      ctrl: true,
      action: () => handleSync(),
      description: 'Refresh agents'
    },
    {
      key: 'e',
      ctrl: true,
      action: () => handleExport('csv'),
      description: 'Export to CSV'
    },
    {
      key: '1',
      alt: true,
      action: () => setActiveTab('active'),
      description: 'Switch to active agents'
    },
    {
      key: '2',
      alt: true,
      action: () => setActiveTab('inactive'),
      description: 'Switch to inactive agents'
    }
  ]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncAgents();
      await refreshAgents();
      toast.success('Agents synchronized successfully');
    } catch (error) {
      toast.error('Failed to sync agents');
    } finally {
      setSyncing(false);
    }
  }, [syncAgents, refreshAgents]);

  const handleDetectSkills = useCallback(async (agentId: string, agentName: string) => {
    console.log('Detecting skills for:', { agentId, agentName });
    setDetectingSkills(agentId);
    setDetectionResult(null);

    try {
      const response = await fetch('/api/skills/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIds: [agentId] }),
      });

      if (!response.ok) throw new Error('Failed to detect skills');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'complete') {
                setDetectionResult(data.summary);
                await refreshAgents();
                toast.success(`Detected ${data.summary.totalSkillsDetected} skills for ${agentName}`);
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error detecting skills:', error);
      toast.error('Failed to detect skills');
    } finally {
      setDetectingSkills(null);
    }
  }, [refreshAgents]);

  const handleSyncTickets = useCallback(async () => {
    setSyncingTickets(true);
    try {
      const response = await fetch('/api/tickets/sync', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to sync tickets');
      const result = await response.json();
      await refreshAgents();
      toast.success(`Synced ${result.count || 0} tickets`);
    } catch (error) {
      console.error('Error syncing tickets:', error);
      toast.error('Failed to sync tickets');
    } finally {
      setSyncingTickets(false);
    }
  }, [refreshAgents]);

  const handleStatusChange = useCallback((agent: any, newStatus: boolean) => {
    setConfirmDialog({
      open: true,
      title: newStatus ? 'Activate Agent' : 'Deactivate Agent',
      description: `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${agent.name}?`,
      variant: newStatus ? 'default' : 'destructive',
      onConfirm: async () => {
        try {
          await updateAgent(agent.id, { isActive: newStatus });
          await refreshAgents();
          toast.success(`Agent ${newStatus ? 'activated' : 'deactivated'} successfully`);
        } catch (error) {
          toast.error('Failed to update agent status');
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [updateAgent, refreshAgents]);

  const handleLevelChange = useCallback((agent: any, newLevel: string) => {
    setConfirmDialog({
      open: true,
      title: 'Change Agent Level',
      description: `Change ${agent.name}'s level from ${agent.level} to ${newLevel}?`,
      onConfirm: async () => {
        try {
          await updateAgent(agent.id, { level: newLevel });
          await refreshAgents();
          toast.success(`Agent level updated to ${newLevel}`);
        } catch (error) {
          toast.error('Failed to update agent level');
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      },
    });
  }, [updateAgent, refreshAgents]);

  // Optimized filtering and sorting with memoization
  const filteredAndSortedAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           agent.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           agent.skills?.some((skill: string) => skill.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
      
      const matchesTab = activeTab === 'active' ? agent.isActive !== false : agent.isActive === false;
      const matchesLevel = !filterLevel || agent.level === filterLevel;
      
      return matchesSearch && matchesTab && matchesLevel;
    });

    // Sort agents
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortConfig.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'ticketCount':
          aValue = a.currentTicketCount || 0;
          bValue = b.currentTicketCount || 0;
          break;
        case 'skills':
          aValue = a.skills?.length || 0;
          bValue = b.skills?.length || 0;
          break;
        case 'level':
          aValue = a.level || '';
          bValue = b.level || '';
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [agents, debouncedSearchTerm, activeTab, filterLevel, sortConfig]);

  const activeAgents = useMemo(() => 
    filteredAndSortedAgents.filter(a => a.isActive !== false),
    [filteredAndSortedAgents]
  );

  const inactiveAgents = useMemo(() => 
    filteredAndSortedAgents.filter(a => a.isActive === false),
    [filteredAndSortedAgents]
  );

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleExport = (format: 'csv' | 'json') => {
    const dataToExport = activeTab === 'active' ? activeAgents : inactiveAgents;
    const exportData = dataToExport.map(agent => ({
      Name: agent.name,
      Email: agent.email,
      Level: agent.level,
      Status: agent.isActive ? 'Active' : 'Inactive',
      'Current Tickets': agent.currentTicketCount || 0,
      Skills: agent.skills?.join(', ') || '',
      Location: agent.location || ''
    }));

    if (format === 'csv') {
      exportToCSV(exportData, `agents_${activeTab}`);
    } else {
      exportToJSON(exportData, `agents_${activeTab}`);
    }
  };

  const stats = useMemo(() => ({
    total: agents.length,
    active: agents.filter(a => a.isActive !== false).length,
    inactive: agents.filter(a => a.isActive === false).length,
    withSkills: agents.filter(a => a.skills && a.skills.length > 0).length,
    overloaded: agents.filter(a => a.currentTicketCount > 8).length
  }), [agents]);

  if (error) {
    return (
      <MainLayout>
        <Card className="p-8 text-center">
          <p className="text-red-600">Error loading agents: {error.message}</p>
          <Button onClick={refreshAgents} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header with stats */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Agent Management</h2>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline">
                <Users className="h-3 w-3 mr-1" />
                {stats.total} total
              </Badge>
              <Badge variant="outline" className="bg-green-50">
                <UserCheck className="h-3 w-3 mr-1" />
                {stats.active} active
              </Badge>
              <Badge variant="outline" className="bg-orange-50">
                <UserX className="h-3 w-3 mr-1" />
                {stats.inactive} inactive
              </Badge>
              {stats.overloaded > 0 && (
                <Badge variant="destructive">
                  {stats.overloaded} overloaded
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              Sync Agents
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncTickets}
              disabled={syncingTickets}
            >
              <TicketIcon className={`h-4 w-4 mr-2 ${syncingTickets ? 'animate-spin' : ''}`} />
              Sync Tickets
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Export as JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => {
                  const emails = filteredAndSortedAgents.map(a => a.email).filter(Boolean).join(', ');
                  copyToClipboard(emails);
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Email List
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search agents by name, email, or skills..."
            className="max-w-md"
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter Level
                {filterLevel && <Badge className="ml-2">{filterLevel}</Badge>}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterLevel(null)}>
                All Levels
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterLevel('L1')}>Level 1</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterLevel('L2')}>Level 2</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterLevel('L3')}>Level 3</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {sortConfig.direction === 'asc' ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                Sort: {sortConfig.field}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleSort('name')}>Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('ticketCount')}>Ticket Count</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('skills')}>Skills Count</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('level')}>Level</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="active">
              Active ({activeAgents?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="inactive">
              Inactive ({inactiveAgents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="lg:col-span-1">
                  <AgentList
                    agents={activeAgents}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                    onDetectSkills={handleDetectSkills}
                    detectingSkills={detectingSkills}
                    onStatusChange={handleStatusChange}
                    onLevelChange={handleLevelChange}
                  />
                </Card>
                <Card className="lg:col-span-1">
                  {selectedAgent ? (
                    <div className="space-y-4 p-6">
                      <AgentDetail agent={selectedAgent} />
                      <SkillManager
                        agent={selectedAgent}
                        onUpdate={refreshAgents}
                      />
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      Select an agent to view details
                    </div>
                  )}
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="inactive" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="lg:col-span-1">
                  <AgentList
                    agents={inactiveAgents}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                    onDetectSkills={handleDetectSkills}
                    detectingSkills={detectingSkills}
                    onStatusChange={handleStatusChange}
                    onLevelChange={handleLevelChange}
                  />
                </Card>
                <Card className="lg:col-span-1">
                  {selectedAgent ? (
                    <div className="space-y-4 p-6">
                      <AgentDetail agent={selectedAgent} />
                      <SkillManager
                        agent={selectedAgent}
                        onUpdate={refreshAgents}
                      />
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      Select an agent to view details
                    </div>
                  )}
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
          title={confirmDialog.title}
          description={confirmDialog.description}
          confirmText="Confirm"
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
        />
      </div>
    </MainLayout>
  );
}