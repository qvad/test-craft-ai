import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { API_CONFIG, ApiConfig, defaultApiConfig } from './api.config';

/**
 * Standardized API error response structure.
 */
export interface ApiError {
  /** HTTP status code */
  status: number;
  /** Human-readable error message */
  message: string;
  /** Additional error details from the server */
  details?: unknown;
}

/**
 * Base service for all API calls. Provides standardized HTTP methods
 * with automatic timeout handling and error transformation.
 *
 * @example
 * ```typescript
 * @Injectable({ providedIn: 'root' })
 * export class UsersApiService extends BaseApiService {
 *   getUsers() {
 *     return this.get<User[]>('/users');
 *   }
 * }
 * ```
 */
@Injectable({
  providedIn: 'root'
})
export class BaseApiService {
  protected readonly http = inject(HttpClient);
  protected readonly config: ApiConfig = inject(API_CONFIG, { optional: true }) ?? defaultApiConfig;

  /**
   * Performs a GET request.
   * @param endpoint - API endpoint path (e.g., '/users')
   * @param params - Optional query parameters
   * @returns Observable of the response body
   */
  protected get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Observable<T> {
    const httpParams = this.buildParams(params);
    return this.http.get<T>(`${this.config.baseUrl}${endpoint}`, { params: httpParams }).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError)
    );
  }

  /**
   * Performs a POST request.
   * @param endpoint - API endpoint path
   * @param body - Request body
   * @returns Observable of the response body
   */
  protected post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.config.baseUrl}${endpoint}`, body).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError)
    );
  }

  /**
   * Performs a PUT request (full resource replacement).
   * @param endpoint - API endpoint path
   * @param body - Request body
   * @returns Observable of the response body
   */
  protected put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.config.baseUrl}${endpoint}`, body).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError)
    );
  }

  /**
   * Performs a PATCH request (partial resource update).
   * @param endpoint - API endpoint path
   * @param body - Partial update body
   * @returns Observable of the response body
   */
  protected patch<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.config.baseUrl}${endpoint}`, body).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError)
    );
  }

  /**
   * Performs a DELETE request.
   * @param endpoint - API endpoint path
   * @returns Observable of the response body
   */
  protected delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.config.baseUrl}${endpoint}`).pipe(
      timeout(this.config.timeout),
      catchError(this.handleError)
    );
  }

  /**
   * Builds HttpParams from a plain object, filtering out null/undefined values.
   */
  private buildParams(params?: Record<string, string | number | boolean>): HttpParams {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, String(value));
        }
      });
    }
    return httpParams;
  }

  /**
   * Transforms HTTP errors into standardized ApiError format.
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    const apiError: ApiError = {
      status: error.status,
      message: error.error?.message ?? error.message ?? 'Unknown error occurred',
      details: error.error?.details
    };
    console.error('API Error:', apiError);
    return throwError(() => apiError);
  }
}
