'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/main-layout';
import { SkillDetectionConfig } from '@/components/skills/skill-detection-config';
import { PendingSkillsReview } from '@/components/skills/pending-skills-review';
import { SkillDetectionStats } from '@/components/skills/skill-detection-stats';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Play, 
  Settings, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  RefreshCw 
} from 'lucide-react';

export default function SkillsPage() {
  const [loading, setLoading] = useState(false);
  const [runningDetection, setRunningDetection] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [stats, setStats] = useState(null);
  const [pendingSkills, setPendingSkills] = useState(null);
  const [configs, setConfigs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchPendingSkills(),
        fetchConfigs()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/skills/detection/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchPendingSkills = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/skills/detection/pending');
      const data = await response.json();
      setPendingSkills(data);
    } catch (error) {
      console.error('Failed to fetch pending skills:', error);
    }
  };

  const fetchConfigs = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/skills/detection/config');
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  };

  const runDetection = async (agentId?: string) => {
    setRunningDetection(true);
    setDetectionResult(null);
    
    try {
      const url = agentId 
        ? `http://localhost:3001/api/skills/detection/run?agentId=${agentId}`
        : 'http://localhost:3001/api/skills/detection/run';
        
      const response = await fetch(url, { method: 'POST' });
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
      await fetch('http://localhost:3001/api/skills/detection/init', { 
        method: 'POST' 
      });
      await fetchConfigs();
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

        {/* Detection Result Alert */}
        {detectionResult && (
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

        {/* Initialize Config if needed */}
        {configs.length === 0 && (
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
        )}

        {/* Stats Overview */}
        {stats && <SkillDetectionStats stats={stats} />}

        {/* Main Content Tabs */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Pending Review
              {pendingSkills?.total > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {pendingSkills.total}
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
              <PendingSkillsReview 
                pendingSkills={pendingSkills}
                onUpdate={loadData}
              />
            )}
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