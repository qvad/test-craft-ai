/**
 * Security Headers Plugin
 * Adds security headers similar to helmet.js
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config/index.js';

export interface SecurityHeadersOptions {
  /** Enable Content Security Policy */
  contentSecurityPolicy?: boolean | ContentSecurityPolicyOptions;
  /** Enable Cross-Origin-Embedder-Policy */
  crossOriginEmbedderPolicy?: boolean;
  /** Enable Cross-Origin-Opener-Policy */
  crossOriginOpenerPolicy?: boolean;
  /** Enable Cross-Origin-Resource-Policy */
  crossOriginResourcePolicy?: boolean;
  /** Enable DNS Prefetch Control */
  dnsPrefetchControl?: boolean;
  /** Enable Expect-CT */
  expectCt?: boolean;
  /** Enable Frameguard (X-Frame-Options) */
  frameguard?: boolean | FrameguardOptions;
  /** Enable HSTS */
  hsts?: boolean | HstsOptions;
  /** Enable IE No Open */
  ieNoOpen?: boolean;
  /** Enable No Sniff */
  noSniff?: boolean;
  /** Enable Origin Agent Cluster */
  originAgentCluster?: boolean;
  /** Enable Permitted Cross Domain Policies */
  permittedCrossDomainPolicies?: boolean;
  /** Enable Referrer Policy */
  referrerPolicy?: boolean | ReferrerPolicyOptions;
  /** Enable XSS Filter */
  xssFilter?: boolean;
}

interface ContentSecurityPolicyOptions {
  directives?: Record<string, string[]>;
  reportOnly?: boolean;
}

interface FrameguardOptions {
  action?: 'deny' | 'sameorigin';
}

interface HstsOptions {
  maxAge?: number;
  includeSubDomains?: boolean;
  preload?: boolean;
}

interface ReferrerPolicyOptions {
  policy?: string | string[];
}

const defaultOptions: SecurityHeadersOptions = {
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: false, // Can break some features
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  expectCt: false, // Deprecated
  frameguard: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true,
};

async function securityHeadersPlugin(
  fastify: FastifyInstance,
  userOptions: SecurityHeadersOptions = {}
): Promise<void> {
  const options = { ...defaultOptions, ...userOptions };

  fastify.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply) => {
    // Content Security Policy
    if (options.contentSecurityPolicy && config.security.helmet.contentSecurityPolicy) {
      const cspOptions = typeof options.contentSecurityPolicy === 'object'
        ? options.contentSecurityPolicy
        : {};

      const directives = cspOptions.directives || {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'font-src': ["'self'", 'https:', 'data:'],
        'form-action': ["'self'"],
        'frame-ancestors': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'object-src': ["'none'"],
        'script-src': ["'self'"],
        'script-src-attr': ["'none'"],
        'style-src': ["'self'", 'https:', "'unsafe-inline'"],
        'upgrade-insecure-requests': [],
      };

      const cspValue = Object.entries(directives)
        .map(([key, values]) => {
          if (values.length === 0) return key;
          return `${key} ${values.join(' ')}`;
        })
        .join('; ');

      const headerName = cspOptions.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';

      reply.header(headerName, cspValue);
    }

    // Cross-Origin-Embedder-Policy
    if (options.crossOriginEmbedderPolicy) {
      reply.header('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    // Cross-Origin-Opener-Policy
    if (options.crossOriginOpenerPolicy) {
      reply.header('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Cross-Origin-Resource-Policy
    if (options.crossOriginResourcePolicy) {
      reply.header('Cross-Origin-Resource-Policy', 'same-origin');
    }

    // DNS Prefetch Control
    if (options.dnsPrefetchControl) {
      reply.header('X-DNS-Prefetch-Control', 'off');
    }

    // Frameguard (X-Frame-Options)
    if (options.frameguard) {
      const frameguardOptions = typeof options.frameguard === 'object'
        ? options.frameguard
        : {};
      const action = frameguardOptions.action || 'SAMEORIGIN';
      reply.header('X-Frame-Options', action.toUpperCase());
    }

    // HSTS
    if (options.hsts && config.isProduction) {
      const hstsConfig = config.security.helmet.hsts;
      const hstsOptions = typeof options.hsts === 'object' ? options.hsts : {};

      const maxAge = hstsOptions.maxAge ?? hstsConfig.maxAge;
      const includeSubDomains = hstsOptions.includeSubDomains ?? hstsConfig.includeSubDomains;
      const preload = hstsOptions.preload ?? hstsConfig.preload;

      let hstsValue = `max-age=${maxAge}`;
      if (includeSubDomains) hstsValue += '; includeSubDomains';
      if (preload) hstsValue += '; preload';

      reply.header('Strict-Transport-Security', hstsValue);
    }

    // IE No Open
    if (options.ieNoOpen) {
      reply.header('X-Download-Options', 'noopen');
    }

    // No Sniff
    if (options.noSniff) {
      reply.header('X-Content-Type-Options', 'nosniff');
    }

    // Origin Agent Cluster
    if (options.originAgentCluster) {
      reply.header('Origin-Agent-Cluster', '?1');
    }

    // Permitted Cross Domain Policies
    if (options.permittedCrossDomainPolicies) {
      reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    }

    // Referrer Policy
    if (options.referrerPolicy) {
      const referrerOptions = typeof options.referrerPolicy === 'object'
        ? options.referrerPolicy
        : {};
      const policy = referrerOptions.policy || 'no-referrer';
      const policyValue = Array.isArray(policy) ? policy.join(', ') : policy;
      reply.header('Referrer-Policy', policyValue);
    }

    // XSS Filter (legacy, but still useful for older browsers)
    if (options.xssFilter) {
      reply.header('X-XSS-Protection', '0'); // Modern recommendation is 0
    }

    // Remove potentially dangerous headers
    reply.removeHeader('X-Powered-By');
  });
}

export default fp(securityHeadersPlugin, {
  name: 'security-headers',
  fastify: '4.x',
});
