import { describe, expect, it, vi } from "vitest";
import { resolvePostgresConnection } from "./provider";

vi.mock("cloudflare:workers", () => ({ env: {} }));

describe("resolvePostgresConnection", () => {
  it("uses Hyperdrive in Workers and a direct URL only in the Docker runtime", () => {
    expect(
      resolvePostgresConnection({
        HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
        POSTGRES_DATABASE_URL: "postgres://direct",
      }),
    ).toEqual({
      connectionString: "postgres://hyperdrive",
      runtime: "hyperdrive",
    });

    expect(
      resolvePostgresConnection({
        CLOUDFLARE_INCLUDE_PROCESS_ENV: "true",
        POSTGRES_DATABASE_URL: "postgres://direct",
      }),
    ).toEqual({ connectionString: "postgres://direct", runtime: "direct" });

    expect(() =>
      resolvePostgresConnection({
        POSTGRES_DATABASE_URL: "postgres://direct",
      }),
    ).toThrow(/requires a HYPERDRIVE binding/i);
  });
});
