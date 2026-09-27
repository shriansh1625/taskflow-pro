/**
 * SQLite schema is canonical. Postgres is the same models with a provider swap
 * so Vercel can use Neon. Do not edit models in the Postgres file by hand.
 */
export function postgresSchemaFromSqlite(source: string): string {
  const start = source.indexOf("model ");
  if (start < 0 || !source.includes('provider = "sqlite"')) {
    throw new Error("Expected the SQLite Prisma schema.");
  }
  const header = `generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;
  return header + source.slice(start).replace(/\s+$/, "") + "\n";
}
