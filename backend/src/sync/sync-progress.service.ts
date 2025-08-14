import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Subject } from 'rxjs';

export interface SyncProgressEvent {
  type: 'agents' | 'tickets' | 'categories' | 'skills' | 'workload';
  status: 'started' | 'progress' | 'completed' | 'error';
  current?: number;
  total?: number;
  message: string;
  details?: any;
}

@Injectable()
export class SyncProgressService {
  private progressSubject = new Subject<SyncProgressEvent>();
  public progress$ = this.progressSubject.asObservable();

  constructor(private eventEmitter: EventEmitter2) {}

  emitProgress(event: SyncProgressEvent) {
    // Emit for SSE subscribers
    this.progressSubject.next(event);
    
    // Also emit as event for internal listeners
    this.eventEmitter.emit('sync.progress', event);
  }

  startSync(type: SyncProgressEvent['type'], total?: number) {
    this.emitProgress({
      type,
      status: 'started',
      total,
      message: `Starting ${type} sync...`
    });
  }

  updateProgress(
    type: SyncProgressEvent['type'], 
    current?: number, 
    total?: number, 
    message?: string
  ) {
    const eventMessage = message || 
      (current !== undefined && total !== undefined 
        ? `Processing ${type}: ${current}/${total}`
        : `Processing ${type}...`);
    
    this.emitProgress({
      type,
      status: 'progress',
      current,
      total,
      message: eventMessage
    });
  }

  completeSync(type: SyncProgressEvent['type'], message: string, details?: any) {
    this.emitProgress({
      type,
      status: 'completed',
      message,
      details
    });
  }

  errorSync(type: SyncProgressEvent['type'], message: string, details?: any) {
    this.emitProgress({
      type,
      status: 'error',
      message,
      details
    });
  }
}