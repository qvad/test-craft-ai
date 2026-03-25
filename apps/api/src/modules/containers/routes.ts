import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { orchestrator } from './orchestrator.js';
import { SUPPORTED_LANGUAGES, LANGUAGE_INFO, type SupportedLanguage } from './types.js';
import { logger } from '../../common/logger.js';

export async function containersRoutes(app: FastifyInstance): Promise<void> {
  // Get all supported languages
  app.get('/languages', async (_request: FastifyRequest, reply: FastifyReply) => {
    const poolStatus = await orchestrator.getPoolStatus();

    const languages = SUPPORTED_LANGUAGES.map((lang) => ({
      ...LANGUAGE_INFO[lang],
      available: (poolStatus[lang]?.ready || 0) > 0,
      pool: poolStatus[lang] || { ready: 0, total: 0 },
    }));

    return reply.send({ languages });
  });

  // Get runner pool status
  app.get('/pools', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const status = await orchestrator.getPoolStatus();
      return reply.send({ pools: status });
    } catch (err) {
      logger.error({ err }, 'Failed to get pool status');
      return reply.status(500).send({ error: 'Failed to get pool status' });
    }
  });

  // Get status for a specific language
  app.get<{ Params: { language: string } }>(
    '/pools/:language',
    async (request, reply) => {
      const { language } = request.params;

      if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
        return reply.status(400).send({ error: `Unsupported language: ${language}` });
      }

      try {
        const status = await orchestrator.getPoolStatus();
        const langStatus = status[language];

        return reply.send({
          language,
          ...LANGUAGE_INFO[language as SupportedLanguage],
          ...langStatus,
        });
      } catch (err) {
        logger.error({ err, language }, 'Failed to get language pool status');
        return reply.status(500).send({ error: 'Failed to get pool status' });
      }
    }
  );

  // Scale runner pool (for manual scaling)
  app.post<{
    Params: { language: string };
    Body: { replicas: number };
  }>('/pools/:language/scale', async (request, reply) => {
    const { language } = request.params;
    const { replicas } = request.body;

    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      return reply.status(400).send({ error: `Unsupported language: ${language}` });
    }

    if (replicas < 0 || replicas > 10) {
      return reply.status(400).send({ error: 'Replicas must be between 0 and 10' });
    }

    // Note: This would need to use the Kubernetes API to scale the deployment
    // For now, return a placeholder response
    return reply.send({
      message: `Scaling ${language} pool to ${replicas} replicas`,
      language,
      targetReplicas: replicas,
    });
  });
}
