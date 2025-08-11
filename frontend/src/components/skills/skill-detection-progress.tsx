import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertCircle, User, Tag } from 'lucide-react';

interface SkillDetectionProgressProps {
  agentId?: string;
  agentName?: string;
  isDetecting: boolean;
  onComplete?: (result: any) => void;
}

export function SkillDetectionProgress({ 
  agentId, 
  agentName,
  isDetecting,
  onComplete 
}: SkillDetectionProgressProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'fetching' | 'analyzing' | 'saving' | 'complete'>('preparing');
  const [details, setDetails] = useState<{
    ticketsFetched?: number;
    categoriesFound?: number;
    skillsDetected?: number;
    currentCategory?: string;
  }>({});

  useEffect(() => {
    if (!isDetecting) {
      setProgress(0);
      setStatus('preparing');
      setDetails({});
      return;
    }

    // Simulate progress for now (replace with actual WebSocket/SSE later)
    const stages = [
      { status: 'preparing' as const, progress: 10, duration: 500 },
      { status: 'fetching' as const, progress: 30, duration: 2000, details: { ticketsFetched: 48 } },
      { status: 'analyzing' as const, progress: 60, duration: 3000, details: { categoriesFound: 18 } },
      { status: 'saving' as const, progress: 90, duration: 1000, details: { skillsDetected: 3 } },
      { status: 'complete' as const, progress: 100, duration: 500 }
    ];

    let currentStage = 0;
    const interval = setInterval(() => {
      if (currentStage >= stages.length) {
        clearInterval(interval);
        if (onComplete) {
          onComplete({
            success: true,
            agentId,
            agentName,
            detectedCount: details.skillsDetected || 0,
            skills: []
          });
        }
        return;
      }

      const stage = stages[currentStage];
      setStatus(stage.status);
      setProgress(stage.progress);
      if (stage.details) {
        setDetails(prev => ({ ...prev, ...stage.details }));
      }
      currentStage++;
    }, 1500);

    return () => clearInterval(interval);
  }, [isDetecting, agentId, agentName, onComplete]);

  if (!isDetecting) return null;

  const getStatusMessage = () => {
    switch (status) {
      case 'preparing':
        return 'Initializing skill detection...';
      case 'fetching':
        return `Fetching ticket history${details.ticketsFetched ? ` (${details.ticketsFetched} tickets)` : '...'}`;
      case 'analyzing':
        return `Analyzing categories${details.categoriesFound ? ` (${details.categoriesFound} found)` : '...'}`;
      case 'saving':
        return `Saving detected skills${details.skillsDetected ? ` (${details.skillsDetected} skills)` : '...'}`;
      case 'complete':
        return 'Detection complete!';
      default:
        return 'Processing...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'preparing':
      case 'fetching':
      case 'analyzing':
      case 'saving':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {getStatusIcon()}
          Detecting Skills {agentName ? `for ${agentName}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{getStatusMessage()}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {Object.keys(details).length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            {details.ticketsFetched !== undefined && (
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {details.ticketsFetched}
                </div>
                <div className="text-xs text-muted-foreground">Tickets Fetched</div>
              </div>
            )}
            {details.categoriesFound !== undefined && (
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {details.categoriesFound}
                </div>
                <div className="text-xs text-muted-foreground">Categories Found</div>
              </div>
            )}
            {details.skillsDetected !== undefined && (
              <div className="text-center p-2 bg-white rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {details.skillsDetected}
                </div>
                <div className="text-xs text-muted-foreground">Skills Detected</div>
              </div>
            )}
          </div>
        )}

        {status === 'analyzing' && details.currentCategory && (
          <div className="text-sm text-muted-foreground text-center">
            Analyzing: {details.currentCategory}
          </div>
        )}
      </CardContent>
    </Card>
  );
}