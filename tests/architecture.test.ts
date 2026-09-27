import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { postgresSchemaFromSqlite } from "@/server/prisma-variant";

function sourceFiles(dir: string): string[] {
  const root = path.join(process.cwd(), dir);
  const out: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(path.relative(process.cwd(), full)));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function assertClean(dir: string, forbidden: RegExp[]) {
  for (const file of sourceFiles(dir)) {
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      expect(text, `${path.relative(process.cwd(), file)} matches ${pattern}`).not.toMatch(pattern);
    }
  }
}

describe("layer boundaries", () => {
  it("keeps the engine free of IO, React, and Prisma", () => {
    assertClean("src/engine", [
      /@\/server/,
      /@prisma\/client/,
      /from "react"/,
      /from "next/,
      /node:fs/,
      /node:child_process/,
    ]);
  });

  it("keeps React components off the database", () => {
    assertClean("src/components", [/@\/server/, /@prisma\/client/]);
  });

  it("keeps the server off React components", () => {
    assertClean("src/server", [/@\/components/, /from "react"/]);
  });

  it("derives the Postgres schema from the SQLite models", () => {
    const sqlite = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const postgres = fs.readFileSync(path.join(process.cwd(), "prisma/schema.postgres.prisma"), "utf8");
    expect(postgres.replace(/\r\n/g, "\n")).toBe(postgresSchemaFromSqlite(sqlite.replace(/\r\n/g, "\n")));
    expect(postgres).toContain('provider = "postgresql"');
    expect(postgres).toContain("model Task");
    expect(postgres).toContain("model Dependency");
  });
});
