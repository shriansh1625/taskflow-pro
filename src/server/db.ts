import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("postgres")) return url;
  const extra: string[] = [];
  if (!url.includes("connection_limit=")) extra.push("connection_limit=1");
  if (!url.includes("connect_timeout=")) extra.push("connect_timeout=15");
  if (extra.length === 0) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${extra.join("&")}`;
}

const datasource = datasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(datasource ? { datasources: { db: { url: datasource } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
