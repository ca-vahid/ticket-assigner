import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Loader2, AlertCircle, X } from 'lucide-react';
import { useSyncProgress } from '@/hooks/useSyncProgress';

export function SyncProgressBar() {
  const { isConnected, progress } = useSyncProgress();
  const [visible, setVisible] = useState(false);
  const [hideTimeout, setHideTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (progress) {
      setVisible(true);
      
      // Clear any existing timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        setHideTimeout(null);
      }
      
      // Auto-hide after completion
      if (progress.status === 'completed') {
        const timeout = setTimeout(() => {
          setVisible(false);
        }, 5000); // Hide after 5 seconds
        setHideTimeout(timeout);
      }
    }
  }, [progress]);

  if (!visible || !progress) return null;

  const getProgressValue = () => {
    if (!progress.current || !progress.total) return 0;
    // Cap at 100% to prevent overflow
    return Math.min((progress.current / progress.total) * 100, 100);
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'started':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getTypeLabel = () => {
    switch (progress.type) {
      case 'agents':
        return 'Syncing Agents';
      case 'tickets':
        return 'Syncing Tickets';
      case 'categories':
        return 'Syncing Categories';
      case 'skills':
        return 'Detecting Skills';
      case 'workload':
        return 'Calculating Workloads';
      default:
        return 'Processing';
    }
  };

  const shouldShowProgress = progress.status === 'progress' && progress.current !== undefined && progress.total !== undefined;
  const isIndeterminate = progress.status === 'progress' && (progress.current === undefined || progress.total === undefined);

  const handleClose = () => {
    setVisible(false);
    if (hideTimeout) {
      clearTimeout(hideTimeout);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="font-medium text-sm">{getTypeLabel()}</span>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-yellow-500">Reconnecting...</span>
            </div>
          )}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        {progress.message}
      </p>
      
      {shouldShowProgress && (
        <div className="space-y-1">
          <Progress value={getProgressValue()} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{progress.current} / {progress.total}</span>
            <span>{getProgressValue().toFixed(0)}%</span>
          </div>
        </div>
      )}
      
      {isIndeterminate && (
        <div className="space-y-1">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <div className="text-xs text-gray-500 text-center">
            Processing...
          </div>
        </div>
      )}
      
      {progress.status === 'completed' && progress.details && (
        <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {Object.entries(progress.details).map(([key, value]) => (
            <div key={key}>
              <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}