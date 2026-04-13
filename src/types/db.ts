/**
 * Minimal abstraction for a DB query runner.
 * DatabaseConnection (executor/db-connection.ts) satisfies this interface.
 */
export interface DbQueryRunner {
  query(sql: string): Promise<Array<Record<string, unknown>>>;
  teardown(): Promise<void>;
}
