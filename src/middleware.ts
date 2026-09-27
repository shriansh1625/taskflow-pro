import { NextResponse, type NextRequest } from "next/server";

const BOARD_COOKIE = "tf_board";
const BOARD_ID = /^[a-f0-9]{32}$/;

export function middleware(request: NextRequest) {
  const current = request.cookies.get(BOARD_COOKIE)?.value;
  const boardId = current && BOARD_ID.test(current) ? current : crypto.randomUUID().replaceAll("-", "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-board-id", boardId);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.set({
    name: BOARD_COOKIE,
    value: boardId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
