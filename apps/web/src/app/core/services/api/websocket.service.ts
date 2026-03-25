import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, BehaviorSubject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { API_CONFIG, defaultApiConfig } from './api.config';
import { TestExecution, NodeExecutionResult, ExecutionLog } from '../../../shared/models';

/**
 * Types of events that can be received via WebSocket.
 */
export type WebSocketEventType =
  | 'execution:started'
  | 'execution:node:started'
  | 'execution:node:completed'
  | 'execution:node:log'
  | 'execution:completed'
  | 'validation:started'
  | 'validation:progress'
  | 'validation:completed'
  | 'generation:started'
  | 'generation:completed'
  | 'generation:failed';

/**
 * Generic WebSocket event structure.
 * @template T - The type of the event payload
 */
export interface WebSocketEvent<T = unknown> {
  /** Event type identifier */
  type: WebSocketEventType;
  /** Event-specific data */
  payload: T;
}

/** Payload for execution:started events */
export interface ExecutionStartedPayload {
  executionId: string;
  testPlanId: string;
}

/** Payload for execution:node:started events */
export interface NodeStartedPayload {
  executionId: string;
  nodeId: string;
  nodeName: string;
}

/** Payload for execution:node:completed events */
export interface NodeCompletedPayload {
  executionId: string;
  result: NodeExecutionResult;
}

/** Payload for execution:node:log events */
export interface NodeLogPayload {
  executionId: string;
  nodeId: string;
  log: ExecutionLog;
}

/** Payload for execution:completed events */
export interface ExecutionCompletedPayload {
  executionId: string;
  execution: TestExecution;
}

/**
 * WebSocket service for real-time communication with the backend.
 * Handles connection management, automatic reconnection, and event streaming.
 *
 * @description
 * Provides real-time updates for:
 * - Test execution progress and results
 * - Node validation status
 * - Code generation events
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Subscription management for multiple executions
 * - Type-safe event handling
 *
 * @example
 * ```typescript
 * const wsService = inject(WebSocketService);
 *
 * // Connect and subscribe to execution
 * wsService.connect();
 * wsService.subscribeToExecution('exec-123');
 *
 * // Listen for events
 * wsService.onNodeCompleted().subscribe(({ result }) => {
 *   console.log(`Node ${result.nodeId}: ${result.status}`);
 * });
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  private readonly config = inject(API_CONFIG, { optional: true }) ?? defaultApiConfig;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  private readonly events$ = new Subject<WebSocketEvent>();
  private readonly connectionState$ = new BehaviorSubject<'connected' | 'disconnected' | 'connecting'>('disconnected');
  private subscriptions = new Set<string>();

  /** Observable of the current connection state */
  readonly isConnected$ = this.connectionState$.asObservable();

  /**
   * Establishes a WebSocket connection to the server.
   * If already connected, this is a no-op.
   */
  connect(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return;
    }

    this.connectionState$.next('connecting');

    try {
      this.socket = new WebSocket(this.config.wsUrl);

      this.socket.onopen = () => {
        this.connectionState$.next('connected');
        this.reconnectAttempts = 0;
        this.resubscribe();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketEvent;
          this.events$.next(data);
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      this.socket.onclose = () => {
        this.connectionState$.next('disconnected');
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (e) {
      console.error('Failed to create WebSocket connection:', e);
      this.connectionState$.next('disconnected');
    }
  }

  /**
   * Closes the WebSocket connection and clears all subscriptions.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.subscriptions.clear();
    this.connectionState$.next('disconnected');
  }

  /**
   * Subscribes to updates for a specific execution.
   * @param executionId - The execution ID to subscribe to
   */
  subscribeToExecution(executionId: string): void {
    this.send({ type: 'subscribe:execution', executionId });
    this.subscriptions.add(`execution:${executionId}`);
  }

  /**
   * Unsubscribes from updates for a specific execution.
   * @param executionId - The execution ID to unsubscribe from
   */
  unsubscribeFromExecution(executionId: string): void {
    this.send({ type: 'unsubscribe:execution', executionId });
    this.subscriptions.delete(`execution:${executionId}`);
  }

  /**
   * Subscribes to validation updates for a specific node.
   * @param nodeId - The node ID to subscribe to
   */
  subscribeToValidation(nodeId: string): void {
    this.send({ type: 'subscribe:validation', nodeId });
    this.subscriptions.add(`validation:${nodeId}`);
  }

  /**
   * Creates an observable that emits payloads for a specific event type.
   * @template T - The expected payload type
   * @param eventType - The event type to listen for
   * @returns Observable that emits the event payload
   */
  on<T>(eventType: WebSocketEventType): Observable<T> {
    return this.events$.pipe(
      filter((event) => event.type === eventType),
      map((event) => event.payload as T)
    );
  }

  /** Observable for execution:started events */
  onExecutionStarted(): Observable<ExecutionStartedPayload> {
    return this.on<ExecutionStartedPayload>('execution:started');
  }

  /** Observable for execution:node:started events */
  onNodeStarted(): Observable<NodeStartedPayload> {
    return this.on<NodeStartedPayload>('execution:node:started');
  }

  /** Observable for execution:node:completed events */
  onNodeCompleted(): Observable<NodeCompletedPayload> {
    return this.on<NodeCompletedPayload>('execution:node:completed');
  }

  /** Observable for execution:node:log events */
  onNodeLog(): Observable<NodeLogPayload> {
    return this.on<NodeLogPayload>('execution:node:log');
  }

  /** Observable for execution:completed events */
  onExecutionCompleted(): Observable<ExecutionCompletedPayload> {
    return this.on<ExecutionCompletedPayload>('execution:completed');
  }

  /**
   * Sends a message through the WebSocket if connected.
   */
  private send(message: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Attempts to reconnect with exponential backoff.
   * Stops after maxReconnectAttempts.
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect();
    }, delay);
  }

  /**
   * Re-sends subscription messages after reconnection.
   */
  private resubscribe(): void {
    this.subscriptions.forEach((sub) => {
      const [type, id] = sub.split(':');
      if (type === 'execution') {
        this.send({ type: 'subscribe:execution', executionId: id });
      } else if (type === 'validation') {
        this.send({ type: 'subscribe:validation', nodeId: id });
      }
    });
  }

  /** Cleanup on service destruction */
  ngOnDestroy(): void {
    this.disconnect();
    this.events$.complete();
    this.connectionState$.complete();
  }
}
