import { describe, expect, it } from 'vitest'
import {
  HOSTED_MIGRATION_HOLDS,
  REQUIRED_SECRETS,
  canLinearDbPush,
  executableSqlStatements,
  isAlreadyAppliedError,
  isZeroSha,
  missingSecretNames,
  missingSecretsMessage,
  migrationVersion,
  parsePendingMigrations,
  parseThisPushMigrations,
  redactSecrets,
  selectMigrationsToApply,
} from './hosted-migrations.mjs'

describe('hosted-migrations helpers', () => {
  it('lists the exact secret names and never interpolates values', () => {
    expect(REQUIRED_SECRETS).toEqual(['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD'])
    expect(missingSecretNames({ SUPABASE_ACCESS_TOKEN: 'tok', SUPABASE_DB_PASSWORD: 'pw' })).toEqual([])
    expect(missingSecretNames({ SUPABASE_ACCESS_TOKEN: '  ', SUPABASE_DB_PASSWORD: '' })).toEqual(
      REQUIRED_SECRETS,
    )
    const message = missingSecretsMessage(['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD'])
    expect(message).toContain('SUPABASE_ACCESS_TOKEN')
    expect(message).toContain('SUPABASE_DB_PASSWORD')
    expect(message).not.toMatch(/tok|pw|sk-|postgres\./)
  })

  it('parses dry-run pending bullets the CLI prints', () => {
    const output = [
      'DRY RUN: migrations will *not* be pushed to the database.',
      'Would push these migrations:',
      ' • 20261009150000_blog_real_estate_commission_bend.sql',
      ' • 20261014190000_hosted_migration_apply_probe.sql',
      '',
    ].join('\n')
    expect(parsePendingMigrations(output)).toEqual([
      '20261009150000_blog_real_estate_commission_bend.sql',
      '20261014190000_hosted_migration_apply_probe.sql',
    ])
  })

  it('parses this-push paths from git diff', () => {
    const diff = [
      'supabase/migrations/20261014190000_hosted_migration_apply_probe.sql',
      'AGENTS.md',
      'supabase/migrations/20261013180000_crm_suppressions_cleared.sql',
    ].join('\n')
    expect(parseThisPushMigrations(diff)).toEqual([
      '20261014190000_hosted_migration_apply_probe.sql',
      '20261013180000_crm_suppressions_cleared.sql',
    ])
  })

  it('applies only this-push files and skips the standing hold', () => {
    const pending = [
      '20260501000000_legacy_mcp_mismatch.sql',
      '20261009150000_blog_real_estate_commission_bend.sql',
      '20261013180000_crm_suppressions_cleared.sql',
      '20261014190000_hosted_migration_apply_probe.sql',
    ]
    const thisPush = ['20261014190000_hosted_migration_apply_probe.sql']
    const plan = selectMigrationsToApply({ pending, thisPush })
    expect(plan.apply).toEqual(['20261014190000_hosted_migration_apply_probe.sql'])
    expect(plan.skippedHold).toEqual(['20261013180000_crm_suppressions_cleared.sql'])
    expect(plan.skippedNotInPush).toEqual([
      '20260501000000_legacy_mcp_mismatch.sql',
      '20261009150000_blog_real_estate_commission_bend.sql',
    ])
    expect(HOSTED_MIGRATION_HOLDS).toContain('20261013180000_crm_suppressions_cleared.sql')
  })

  it('tolerates already-applied SQL and refuses a linear push when extras are pending', () => {
    expect(isAlreadyAppliedError('ERROR: relation "_hosted_migration_apply_probe" already exists')).toBe(
      true,
    )
    expect(isAlreadyAppliedError('duplicate key value violates unique constraint')).toBe(true)
    expect(isAlreadyAppliedError('syntax error at or near SELECT')).toBe(false)
    expect(
      canLinearDbPush({
        pending: ['20261014190000_hosted_migration_apply_probe.sql'],
        apply: ['20261014190000_hosted_migration_apply_probe.sql'],
      }),
    ).toBe(true)
    expect(
      canLinearDbPush({
        pending: [
          '20261009150000_blog_real_estate_commission_bend.sql',
          '20261014190000_hosted_migration_apply_probe.sql',
        ],
        apply: ['20261014190000_hosted_migration_apply_probe.sql'],
      }),
    ).toBe(false)
    expect(
      canLinearDbPush({
        pending: [
          '20261013180000_crm_suppressions_cleared.sql',
          '20261014190000_hosted_migration_apply_probe.sql',
        ],
        apply: ['20261014190000_hosted_migration_apply_probe.sql'],
      }),
    ).toBe(false)
  })

  it('redacts secret values and reads the 14-digit version', () => {
    const env = {
      SUPABASE_ACCESS_TOKEN: 'sbp_secret_token_value',
      SUPABASE_DB_PASSWORD: 'super-secret-db-pass',
    }
    expect(redactSecrets('token=sbp_secret_token_value pass=super-secret-db-pass', env)).toBe(
      'token=*** pass=***',
    )
    expect(migrationVersion('supabase/migrations/20261014190000_hosted_migration_apply_probe.sql')).toBe(
      '20261014190000',
    )
    expect(isZeroSha('0000000000000000000000000000000000000000')).toBe(true)
    expect(isZeroSha('39108538f')).toBe(false)
  })

  it('splits a COMMENT / CREATE TABLE probe into executable statements', () => {
    const sql = `
-- Harmless apply-on-main proof.
CREATE TABLE IF NOT EXISTS public._hosted_migration_apply_probe (
  applied_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public._hosted_migration_apply_probe IS
  'Unused probe table.';
`
    const statements = executableSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toMatch(/CREATE TABLE IF NOT EXISTS public\._hosted_migration_apply_probe/i)
    expect(statements[1]).toMatch(/COMMENT ON TABLE public\._hosted_migration_apply_probe/i)
  })

  it('lists the missing-secret names Matt must add', () => {
    expect(missingSecretsMessage(['SUPABASE_ACCESS_TOKEN'])).toContain(
      'Settings → Secrets and variables → Actions',
    )
  })
})
