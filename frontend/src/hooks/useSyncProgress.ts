import { useEffect, useState, useRef } from 'react';

export interface SyncProgressEvent {
  type: 'agents' | 'tickets' | 'categories' | 'skills' | 'workload';
  status: 'started' | 'progress' | 'completed' | 'error';
  current?: number;
  total?: number;
  message: string;
  details?: any;
}

export function useSyncProgress() {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);
  const [progressHistory, setProgressHistory] = useState<SyncProgressEvent[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to SSE endpoint
    const connect = () => {
      try {
        const eventSource = new EventSource('http://localhost:3001/api/admin/sync/progress');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('SSE connection opened');
          setIsConnected(true);
        };

        eventSource.addEventListener('sync-progress', (event) => {
          try {
            const data = JSON.parse(event.data);
            setProgress(data);
            setProgressHistory(prev => [...prev, data]);
          } catch (error) {
            console.error('Failed to parse SSE data:', error);
          }
        });

        eventSource.onerror = (error) => {
          console.error('SSE error:', error);
          setIsConnected(false);
          
          // Attempt to reconnect after 5 seconds
          setTimeout(() => {
            if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
              connect();
            }
          }, 5000);
        };
      } catch (error) {
        console.error('Failed to create EventSource:', error);
        setIsConnected(false);
      }
    };

    connect();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const clearHistory = () => {
    setProgressHistory([]);
    setProgress(null);
  };

  return {
    isConnected,
    progress,
    progressHistory,
    clearHistory
  };
}