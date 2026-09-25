import { describe, expect, it } from "vitest";
import { BoardError } from "@/server/board-store";
import { jsonError, jsonFail, readJson } from "@/server/http";

describe("http errors", () => {
  it("returns BoardError status and path", async () => {
    const response = jsonError(new BoardError(409, "CYCLE", "loop", ["A", "B", "A"]));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "loop",
      code: "CYCLE",
      path: ["A", "B", "A"],
    });
  });

  it("maps SyntaxError to 400 instead of 500", async () => {
    const response = jsonError(new SyntaxError("Unexpected token"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID" });
  });

  it("jsonFail is a 400 by default", async () => {
    const response = jsonFail("bad");
    expect(response.status).toBe(400);
  });

  it("readJson rejects empty and invalid bodies", async () => {
    await expect(
      readJson(new Request("http://taskflow.local/api", { method: "POST", body: "   " })),
    ).rejects.toMatchObject({ status: 400, code: "INVALID" });
    await expect(
      readJson(new Request("http://taskflow.local/api", { method: "POST", body: "{not json" })),
    ).rejects.toMatchObject({ status: 400, code: "INVALID" });
    await expect(
      readJson(
        new Request("http://taskflow.local/api", {
          method: "POST",
          body: '{"predecessorId":"schema"}',
        }),
      ),
    ).resolves.toEqual({ predecessorId: "schema" });
  });
});
