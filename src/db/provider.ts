import { env } from "cloudflare:workers";

type DatabaseProvider = "d1" | "postgres";

type PostgresEnv = {
  HYPERDRIVE?: { connectionString?: string };
  CLOUDFLARE_INCLUDE_PROCESS_ENV?: string;
  POSTGRES_DATABASE_URL?: string;
};

type PostgresConnection = {
  connectionString: string;
  runtime: "hyperdrive" | "direct";
};

export function getDatabaseProvider(): DatabaseProvider {
  const provider = Reflect.get(env, "DATABASE_PROVIDER");

  if (provider === "postgres") {
    return "postgres";
  }

  if (provider === "d1" || provider === undefined || provider === "") {
    return "d1";
  }

  throw new Error(
    `Unsupported DATABASE_PROVIDER "${String(provider)}". Expected "d1" or "postgres".`,
  );
}

// Workers reach Postgres only through HYPERDRIVE. The Docker self-host runtime
// can use a direct URL because CLOUDFLARE_INCLUDE_PROCESS_ENV is its explicit
// process-env bridge; a bare Worker var never enables the direct path.
export function resolvePostgresConnection(
  runtimeEnv: PostgresEnv,
): PostgresConnection {
  const hyperdriveUrl = runtimeEnv.HYPERDRIVE?.connectionString?.trim();
  if (hyperdriveUrl) {
    return { connectionString: hyperdriveUrl, runtime: "hyperdrive" };
  }

  const directUrl = runtimeEnv.POSTGRES_DATABASE_URL?.trim();
  if (runtimeEnv.CLOUDFLARE_INCLUDE_PROCESS_ENV === "true" && directUrl) {
    return { connectionString: directUrl, runtime: "direct" };
  }

  throw new Error(
    "DATABASE_PROVIDER=postgres requires a HYPERDRIVE binding, or POSTGRES_DATABASE_URL in the Docker self-host runtime.",
  );
}

export function getPostgresConnection() {
  return resolvePostgresConnection(env);
}
