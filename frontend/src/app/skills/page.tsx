'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { SkillDetectionConfig } from '@/components/skills/skill-detection-config';
import { PendingSkillsReviewV2 } from '@/components/skills/pending-skills-review-v2';
import { SkillDetectionStatsV2 } from '@/components/skills/skill-detection-stats-v2';
import { SkillDetectionProgress } from '@/components/skills/skill-detection-progress';
import { ReviewedSkillsView } from '@/components/skills/reviewed-skills-view';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Play, 
  Settings, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock 
} from 'lucide-react';

export default function SkillsPage() {
  const [loading, setLoading] = useState(false);
  const [runningDetection, setRunningDetection] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [pendingSkills, setPendingSkills] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [syncingCategories, setSyncingCategories] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchPendingSkills(),
        fetchConfigs(),
        fetchCategories()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/skills/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchPendingSkills = async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = Date.now();
      const response = await fetch(`/api/skills/detected/pending?_t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      const data = await response.json();
      console.log(`Fetched ${data.total} pending skills`);
      setPendingSkills(data);
    } catch (error) {
      console.error('Failed to fetch pending skills:', error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/skills/config');
      if (!response.ok) {
        console.error('Failed to fetch configs:', response.status, response.statusText);
        setConfigs([]);
        return;
      }
      const data = await response.json();
      console.log('Fetched configs:', data);
      setConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
      setConfigs([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/skills/categories');
      if (!response.ok) {
        console.error('Failed to fetch categories:', response.status, response.statusText);
        setCategories([]);
        return;
      }
      const data = await response.json();
      console.log('Fetched categories:', data);
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      setCategories([]);
    }
  };

  const syncCategories = async () => {
    setSyncingCategories(true);
    try {
      const response = await fetch('/api/skills/categories/sync', { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        await fetchCategories();
      }
    } catch (error) {
      console.error('Failed to sync categories:', error);
    } finally {
      setSyncingCategories(false);
    }
  };

  const runDetection = async (agentId?: string) => {
    setRunningDetection(true);
    setDetectionResult(null);
    
    try {
      const body = agentId 
        ? { agentId }
        : { runAll: true };
        
      const response = await fetch('/api/skills/detect', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      
      setDetectionResult(result);
      
      // Reload data
      await loadData();
    } catch (error) {
      console.error('Failed to run detection:', error);
      setDetectionResult({
        success: false,
        errors: ['Failed to run skill detection']
      });
    } finally {
      setRunningDetection(false);
    }
  };

  const initializeConfig = async () => {
    try {
      // First sync categories from Freshservice
      await syncCategories();
      
      // Initialize default configurations with proper settings
      const configs = [
        { 
          method: 'CATEGORY_BASED', 
          enabled: true, 
          settings: { 
            minimumTickets: 5, 
            lookbackTickets: 500,
            useSecurityField: true,
            includeComplexity: true
          } 
        },
        { method: 'GROUP_MEMBERSHIP', enabled: false, settings: {} },
        { method: 'RESOLUTION_PATTERNS', enabled: false, settings: {} },
        { method: 'TEXT_ANALYSIS_LLM', enabled: false, settings: {} }
      ];
      
      for (const config of configs) {
        try {
          await fetch('/api/skills/config', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          });
        } catch (err) {
          // Config might already exist
        }
      }
      
      // Reload all data
      await loadData();
    } catch (error) {
      console.error('Failed to initialize config:', error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="h-8 w-8 text-purple-600" />
              Skill Detection
            </h2>
            <p className="text-muted-foreground mt-1">
              Automatically detect and manage agent skills based on ticket history
            </p>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => runDetection()}
              disabled={runningDetection}
              size="lg"
            >
              {runningDetection ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Running Detection...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Detection
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Detection Progress */}
        <SkillDetectionProgress 
          isDetecting={runningDetection}
          onComplete={(result) => {
            setDetectionResult(result);
            setRunningDetection(false);
            loadData();
          }}
        />

        {/* Detection Result Alert */}
        {detectionResult && !runningDetection && (
          <Alert className={detectionResult.success ? 'border-green-500' : 'border-red-500'}>
            <div className="flex items-start gap-2">
              {detectionResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription>
                  {detectionResult.success ? (
                    <div>
                      <strong>Detection Complete!</strong>
                      <div className="mt-1 text-sm">
                        • Processed {detectionResult.agentsProcessed} agents<br/>
                        • Detected {detectionResult.skillsDetected} new skills
                        {detectionResult.errors?.length > 0 && (
                          <div className="mt-2 text-red-600">
                            {detectionResult.errors.length} errors occurred
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong>Detection Failed</strong>
                      <div className="mt-1 text-sm text-red-600">
                        {detectionResult.errors?.join(', ')}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </div>
            </div>
          </Alert>
        )}

        {/* Categories Display */}
        <Alert className={categories.length > 0 ? "border-blue-500" : "border-yellow-500"}>
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <strong>Security Categories</strong>
                {categories.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categories.map((cat: any) => (
                        <Badge key={cat.id} variant="outline">
                          {cat.name}
                          {cat.ticketCount > 0 && (
                            <span className="ml-1 text-xs text-muted-foreground">({cat.ticketCount})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {categories.length} categories found from ticket data
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground mt-2">
                    No categories found. Click 'Sync Categories' to fetch from recent tickets.
                  </div>
                )}
              </div>
              <Button 
                onClick={syncCategories} 
                disabled={syncingCategories}
                size="sm"
                variant="outline"
              >
                {syncingCategories ? 'Syncing...' : categories.length > 0 ? 'Refresh' : 'Sync Categories'}
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        {/* Configuration Status */}
        {configs.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>No detection methods configured. Initialize default configuration?</span>
                <Button onClick={initializeConfig} size="sm">
                  Initialize
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>System Initialized</strong>
                  <div className="text-sm text-muted-foreground mt-1">
                    {configs.filter(c => c.enabled).length} of {configs.length} detection methods enabled
                    {configs.find(c => c.method === 'CATEGORY_BASED')?.enabled && 
                      ' • Category-based detection active (5+ tickets required)'}
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Overview */}
        {stats && <SkillDetectionStatsV2 stats={stats} isRefreshing={loading} />}

        {/* Main Content Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pending Review
              {pendingSkills?.total > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {pendingSkills.total}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Approved
              {stats?.detectedSkills?.approved > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                  {stats.detectedSkills.approved}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejected
              {stats?.detectedSkills?.rejected > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                  {stats.detectedSkills.rejected}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {pendingSkills && (
              <PendingSkillsReviewV2 
                pendingSkills={pendingSkills}
                onUpdate={loadData}
              />
            )}
          </TabsContent>

          <TabsContent value="approved">
            <ReviewedSkillsView type="approved" />
          </TabsContent>

          <TabsContent value="rejected">
            <ReviewedSkillsView type="rejected" />
          </TabsContent>

          <TabsContent value="config">
            <SkillDetectionConfig 
              configs={configs}
              onUpdate={fetchConfigs}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}