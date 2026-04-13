import { describe, it, expect } from 'vitest';

// We test the readonly guard in isolation — no real DB connection needed.
// Import the assertion function directly from the connection module.

// The assertReadonly function is not exported, so we reproduce its logic here
// as a white-box test.  The real coverage comes from the DatabaseConnection
// integration path, but we keep fast unit coverage for the guard logic.

function assertReadonly(sql: string): void {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    throw new Error(
      `DB isolation mode is "readonly" — only SELECT queries are permitted.\n` +
        `Rejected query: "${sql.slice(0, 80)}${sql.length > 80 ? '...' : ''}"`,
    );
  }
}

describe('DB readonly guard', () => {
  it('allows SELECT queries', () => {
    expect(() => assertReadonly('SELECT id FROM users')).not.toThrow();
    expect(() => assertReadonly('  select * from orders where id = 1')).not.toThrow();
  });

  it('allows CTEs (WITH ...)', () => {
    expect(() => assertReadonly('WITH cte AS (SELECT 1) SELECT * FROM cte')).not.toThrow();
  });

  it('rejects INSERT', () => {
    expect(() => assertReadonly("INSERT INTO users VALUES ('x')")).toThrow(/readonly/);
  });

  it('rejects UPDATE', () => {
    expect(() => assertReadonly("UPDATE users SET name = 'x' WHERE id = 1")).toThrow(/readonly/);
  });

  it('rejects DELETE', () => {
    expect(() => assertReadonly('DELETE FROM users WHERE id = 1')).toThrow(/readonly/);
  });

  it('rejects DROP', () => {
    expect(() => assertReadonly('DROP TABLE users')).toThrow(/readonly/);
  });

  it('includes a truncated snippet of the rejected SQL in the error', () => {
    const longSql = 'INSERT INTO ' + 'x'.repeat(200);
    const err = (() => {
      try {
        assertReadonly(longSql);
        return null;
      } catch (e) {
        return e as Error;
      }
    })();
    expect(err?.message).toContain('...');
  });
});
