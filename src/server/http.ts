import { NextResponse } from "next/server";
import { BoardError } from "./board-store";

export function jsonBoard(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export function jsonFail(message: string, status = 400, code = "INVALID") {
  return NextResponse.json({ error: message, code }, { status });
}

export function jsonError(error: unknown) {
  if (error instanceof BoardError) {
    return NextResponse.json(
      { error: error.message, code: error.code, path: error.path },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
}
