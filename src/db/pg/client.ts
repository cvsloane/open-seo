/* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-type-assertion -- The proxy resolves the request-scoped Postgres client from AsyncLocalStorage. */
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseProvider, getPostgresConnection } from "@/db/provider";
import { withQueryRetries } from "./retry";
import * as schema from "./schema";

// Postgres on Cloudflare Workers requires a PER-REQUEST client: the runtime
// forbids using a socket created by one request from a different request
// ("Cannot perform I/O on behalf of a different request"), and Hyperdrive does
// not lift that — its docs are explicit that the client must be created inside
// the handler, never in global scope. So we keep the active client in
// AsyncLocalStorage, seeded by `withPgClient` at each entrypoint. In D1 mode
// (the default) none of this runs.
type Sql = ReturnType<typeof postgres>;

function createPgDb(sql: Sql) {
  return drizzle(sql, { schema });
}

const pgClientStore = new AsyncLocalStorage<{
  sql: Sql;
  db: ReturnType<typeof createPgDb>;
}>();

let directStore:
  | {
      connectionString: string;
      sql: Sql;
      db: ReturnType<typeof createPgDb>;
    }
  | undefined;

function getDirectStore(connectionString: string) {
  if (!directStore) {
    const sql = withQueryRetries(
      postgres(connectionString, {
        max: 10,
        fetch_types: false,
        prepare: false,
        connect_timeout: 10,
      }),
    );
    directStore = { connectionString, sql, db: createPgDb(sql) };
  }

  if (directStore.connectionString !== connectionString) {
    throw new Error(
      "POSTGRES_DATABASE_URL changed after the Docker connection pool started. Restart the process to apply it.",
    );
  }

  return directStore;
}

export const pgDb = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const store = pgClientStore.getStore();
      if (!store) {
        throw new Error(
          "Postgres database accessed outside a request scope. Entrypoints " +
            "(fetch, scheduled, workflow run) must wrap DB usage in withPgClient().",
        );
      }
      return Reflect.get(store.db, prop, receiver);
    },
  },
) as ReturnType<typeof createPgDb>;

/**
 * Run `fn` with a request-scoped Postgres client in scope.
 *
 * - D1 mode (default): a no-op — just runs `fn` (no Postgres client created).
 * - Postgres mode: creates a fresh per-request client and makes it the active
 *   `pgDb` for the duration of `fn`.
 *
 * Wrap every entrypoint that touches the DB: the `fetch` handler, the
 * `scheduled` cron, and each WorkflowEntrypoint `run`.
 *
 * Workers use a request-scoped Hyperdrive client with one connection. Docker
 * owns one process-scoped pool that connects through PgBouncer; request scopes
 * borrow that pool so streamed responses keep a valid client after the fetch
 * handler returns.
 */
export async function withPgClient<T>(fn: () => Promise<T>): Promise<T> {
  if (getDatabaseProvider() !== "postgres") {
    return fn();
  }
  // Reentrant: nested scopes (e.g. a DO hook calling helpers that defensively
  // scope themselves) reuse the ambient client instead of opening another
  // connection. Workflow steps are unaffected — ALS never crosses step.do, so
  // each step's own wrap still creates its client.
  if (pgClientStore.getStore()) {
    return fn();
  }
  const connection = getPostgresConnection();
  if (connection.runtime === "direct") {
    const store = getDirectStore(connection.connectionString);
    return pgClientStore.run(store, fn);
  }

  const rawSql = postgres(connection.connectionString, {
    max: 1,
    fetch_types: false,
    // Bound connect stalls (seconds) so the per-query retry in
    // withQueryRetries gets its turn within the request's lifetime instead
    // of hanging on postgres.js's 30s default during a failover.
    connect_timeout: 10,
  });
  const sql = withQueryRetries(rawSql);
  return pgClientStore.run({ sql, db: createPgDb(sql) }, fn);
}
