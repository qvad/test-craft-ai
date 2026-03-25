import { InjectionToken } from '@angular/core';

export interface ApiConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

export const defaultApiConfig: ApiConfig = {
  baseUrl: '/api/v1',
  wsUrl: 'ws://localhost:3000/ws',
  timeout: 30000
};
