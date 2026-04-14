import type { DatabaseConfig } from '../types/index.js';
import { isMaskedValue } from '../types/masked-value.js';
import type { DbQueryRunner } from '../types/db.js';

// ─── Row Type ─────────────────────────────────────────────────────────────────

export type DbRow = Record<string, unknown>;

// ─── Driver Abstraction ───────────────────────────────────────────────────────

interface DbDriver {
  query(sql: string, timeout: number): Promise<DbRow[]>;
  beginTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;
  close(): Promise<void>;
}

// ─── Readonly Guard ───────────────────────────────────────────────────────────

/**
 * Reject any SQL that is not a SELECT statement in readonly mode.
 * This is a best-effort check — the DB driver provides the real enforcement.
 */
function assertReadonly(sql: string): void {
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
    throw new Error(
      `DB isolation mode is "readonly" — only SELECT queries are permitted.\n` +
        `Rejected query: "${sql.slice(0, 80)}${sql.length > 80 ? '...' : ''}"`,
    );
  }
}

// ─── Postgres Driver ─────────────────────────────────────────────────────────

async function buildPostgresDriver(connectionString: string, ssl: boolean): Promise<DbDriver> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();

  return {
    async query(sql, timeout) {
      await client.query(`SET statement_timeout = ${timeout}`);
      const result = await client.query(sql);
      return result.rows as DbRow[];
    },
    async beginTransaction() {
      await client.query('BEGIN');
    },
    async rollbackTransaction() {
      await client.query('ROLLBACK');
    },
    async close() {
      client.release();
      await pool.end();
    },
  };
}

// ─── MySQL Driver ─────────────────────────────────────────────────────────────

async function buildMysqlDriver(connectionString: string): Promise<DbDriver> {
  const mysql = await import('mysql2/promise');
  const connection = await mysql.createConnection(connectionString);

  return {
    async query(sql) {
      const [rows] = await connection.execute(sql);
      return rows as DbRow[];
    },
    async beginTransaction() {
      await connection.beginTransaction();
    },
    async rollbackTransaction() {
      await connection.rollback();
    },
    async close() {
      await connection.end();
    },
  };
}

// ─── SQLite Driver ────────────────────────────────────────────────────────────

async function buildSqliteDriver(filename: string): Promise<DbDriver> {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(filename);

  return {
    async query(sql) {
      return db.prepare(sql).all() as DbRow[];
    },
    async beginTransaction() {
      db.prepare('BEGIN').run();
    },
    async rollbackTransaction() {
      db.prepare('ROLLBACK').run();
    },
    async close() {
      db.close();
    },
  };
}

// ─── MSSQL Driver ─────────────────────────────────────────────────────────────

async function buildMssqlDriver(connectionString: string): Promise<DbDriver> {
  const mssql = await import('mssql');
  const pool = await mssql.connect(connectionString);

  return {
    async query(sql, timeout) {
      const request = pool.request();
      (request as any).timeout = timeout;
      const result = await request.query(sql);
      return result.recordset as DbRow[];
    },
    async beginTransaction() {
      await pool.request().query('BEGIN TRANSACTION');
    },
    async rollbackTransaction() {
      await pool.request().query('ROLLBACK TRANSACTION');
    },
    async close() {
      await pool.close();
    },
  };
}

// ─── Connection Service ───────────────────────────────────────────────────────

export class DatabaseConnection implements DbQueryRunner {
  private driver: DbDriver | null = null;
  private inTransaction = false;

  constructor(private readonly config: DatabaseConfig) {}

  private resolveConnectionString(): string {
    const cs = this.config.connectionString;
    // Unwrap ENV.* reference if it was stored as a MaskedValue
    if (isMaskedValue(cs)) return cs.value;
    return cs;
  }

  async connect(): Promise<void> {
    if (this.driver) return;

    const cs = this.resolveConnectionString();
    const ssl = this.config.ssl ?? false;

    switch (this.config.driver) {
      case 'postgres':
        this.driver = await buildPostgresDriver(cs, ssl);
        break;
      case 'mysql':
        this.driver = await buildMysqlDriver(cs);
        break;
      case 'sqlite':
        this.driver = await buildSqliteDriver(cs);
        break;
      case 'mssql':
        this.driver = await buildMssqlDriver(cs);
        break;
      default: {
        const _exhaustive: never = this.config.driver;
        throw new Error(`Unsupported database driver: "${String(_exhaustive)}"`);
      }
    }

    if (this.config.isolationMode === 'transaction') {
      await this.driver.beginTransaction();
      this.inTransaction = true;
    }
  }

  async query(sql: string): Promise<DbRow[]> {
    if (!this.driver) throw new Error('DatabaseConnection: connect() must be called before query()');

    const isolationMode = this.config.isolationMode ?? 'readonly';
    if (isolationMode === 'readonly') {
      assertReadonly(sql);
    }

    return this.driver.query(sql, this.config.queryTimeout ?? 5000);
  }

  async teardown(): Promise<void> {
    if (!this.driver) return;

    if (this.inTransaction) {
      await this.driver.rollbackTransaction();
      this.inTransaction = false;
    }

    await this.driver.close();
    this.driver = null;
  }
}
