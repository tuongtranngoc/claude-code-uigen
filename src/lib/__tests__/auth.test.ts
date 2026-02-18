// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { SignJWT, jwtVerify } from "jose";

vi.mock("server-only", () => ({}));

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

const JWT_SECRET = new Uint8Array(Buffer.from("development-secret-key"));
const COOKIE_NAME = "auth-token";

let createSession: typeof import("@/lib/auth").createSession;
let getSession: typeof import("@/lib/auth").getSession;

beforeEach(async () => {
  vi.clearAllMocks();
  const auth = await import("@/lib/auth");
  createSession = auth.createSession;
  getSession = auth.getSession;
});

describe("createSession", () => {
  test("sets an httpOnly cookie with a JWT", async () => {
    await createSession("user-1", "test@example.com");

    expect(mockCookieStore.set).toHaveBeenCalledOnce();
    const [name, token, options] = mockCookieStore.set.mock.calls[0];

    expect(name).toBe(COOKIE_NAME);
    expect(typeof token).toBe("string");
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("creates a token containing userId and email", async () => {
    await createSession("user-1", "test@example.com");

    const token = mockCookieStore.set.mock.calls[0][1];
    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("test@example.com");
  });

  test("sets cookie expiration to 7 days", async () => {
    const before = Date.now();
    await createSession("user-1", "test@example.com");
    const after = Date.now();

    const options = mockCookieStore.set.mock.calls[0][2];
    const expires = new Date(options.expires).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;

    expect(expires).toBeGreaterThanOrEqual(before + sevenDays);
    expect(expires).toBeLessThanOrEqual(after + sevenDays);
  });

  test("sets secure flag based on NODE_ENV", async () => {
    await createSession("user-1", "test@example.com");

    const options = mockCookieStore.set.mock.calls[0][2];
    expect(options.secure).toBe(process.env.NODE_ENV === "production");
  });
});

describe("getSession", () => {
  test("returns null when no cookie exists", async () => {
    mockCookieStore.get.mockReturnValue(undefined);

    expect(await getSession()).toBeNull();
  });

  test("returns session payload for a valid token", async () => {
    const token = await new SignJWT({
      userId: "user-1",
      email: "test@example.com",
      expiresAt: new Date().toISOString(),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(JWT_SECRET);
    mockCookieStore.get.mockReturnValue({ value: token });

    const session = await getSession();
    expect(session!.userId).toBe("user-1");
    expect(session!.email).toBe("test@example.com");
  });

  test("returns null for an expired token", async () => {
    const token = await new SignJWT({ userId: "user-1", email: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("0s")
      .setIssuedAt(new Date(Date.now() - 10000))
      .sign(JWT_SECRET);
    await new Promise((r) => setTimeout(r, 50));
    mockCookieStore.get.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });

  test("returns null for an invalid token", async () => {
    mockCookieStore.get.mockReturnValue({ value: "not-a-valid-jwt" });

    expect(await getSession()).toBeNull();
  });

  test("returns null for a token signed with a different secret", async () => {
    const wrongSecret = new Uint8Array(Buffer.from("wrong-secret"));
    const token = await new SignJWT({ userId: "user-1", email: "a@b.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .setIssuedAt()
      .sign(wrongSecret);
    mockCookieStore.get.mockReturnValue({ value: token });

    expect(await getSession()).toBeNull();
  });
});
