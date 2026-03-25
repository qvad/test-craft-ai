#!/usr/bin/env tsx
/**
 * Database Migration CLI Script
 * Usage:
 *   npm run migrate          - Run pending migrations
 *   npm run migrate:rollback - Rollback last migration
 *   npm run migrate:status   - Show migration status
 */

import { config } from 'dotenv';
config();

import { db } from '../modules/database/yugabyte-client.js';
import { migrationRunner, migrations } from '../modules/database/migrations.js';
import { logger } from '../common/logger.js';

async function main(): Promise<void> {
  const command = process.argv[2] || 'migrate';

  try {
    await db.connect();
    logger.info('Connected to database');

    switch (command) {
      case 'migrate':
      case 'up': {
        const result = await migrationRunner.migrate(migrations);
        if (result.applied.length > 0) {
          logger.info({ applied: result.applied }, 'Migrations applied');
        } else {
          logger.info('No pending migrations');
        }
        break;
      }

      case 'rollback':
      case 'down': {
        const count = parseInt(process.argv[3] || '1', 10);
        const rolledBack = await migrationRunner.rollback(migrations, count);
        if (rolledBack.length > 0) {
          logger.info({ rolledBack }, 'Migrations rolled back');
        } else {
          logger.info('No migrations to rollback');
        }
        break;
      }

      case 'status': {
        const status = await migrationRunner.status(migrations);
        console.log('\n=== Migration Status ===\n');
        console.log(`Total migrations: ${status.total}`);
        console.log(`Applied: ${status.applied.length}`);
        console.log(`Pending: ${status.pending.length}`);

        if (status.applied.length > 0) {
          console.log('\nApplied migrations:');
          for (const m of status.applied) {
            console.log(`  ✓ ${m.version} - ${m.name} (${m.applied_at})`);
          }
        }

        if (status.pending.length > 0) {
          console.log('\nPending migrations:');
          for (const m of status.pending) {
            console.log(`  ○ ${m.version} - ${m.name}`);
          }
        }

        console.log('');
        break;
      }

      case 'reset': {
        if (process.env.NODE_ENV === 'production') {
          logger.error('Cannot reset database in production!');
          process.exit(1);
        }

        const confirm = process.argv[3];
        if (confirm !== '--force') {
          logger.error('Reset requires --force flag');
          process.exit(1);
        }

        await migrationRunner.reset();
        logger.info('Database reset complete');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log('\nUsage:');
        console.log('  migrate [up]     - Run pending migrations');
        console.log('  migrate down [n] - Rollback last n migrations');
        console.log('  migrate status   - Show migration status');
        console.log('  migrate reset --force - Reset database (dev only)');
        process.exit(1);
    }
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  } finally {
    await db.close();
  }
}

main();
