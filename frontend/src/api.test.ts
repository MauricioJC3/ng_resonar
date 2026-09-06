import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword, me, SESSION_EXPIRED_EVENT } from "./api";

describe("api req() interceptor", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches resonar:session-expired and throws on 401", async () => {
    fetchMock.mockResolvedValue(new Response("no session", { status: 401 }));
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    await expect(me()).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it("throws an Error carrying .code on the real FastAPI 403 body, with no event", async () => {
    // The real backend raises `HTTPException(403, detail={"code": ...})`, which
    // FastAPI serialises as `{"detail":{"code":"must_change_password"}}`.
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ detail: { code: "must_change_password" } }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const onExpired = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    let err: (Error & { code?: string }) | undefined;
    try {
      await changePassword("old-secret", "new-secret-123456");
    } catch (e) {
      err = e as Error & { code?: string };
    }

    expect(err).toBeInstanceOf(Error);
    expect(err?.code).toBe("must_change_password");
    expect(onExpired).not.toHaveBeenCalled();

    window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  });

  it("also accepts a flattened 403 { code } body for forward-compat", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "must_change_password" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    let err: (Error & { code?: string }) | undefined;
    try {
      await changePassword("old-secret", "new-secret-123456");
    } catch (e) {
      err = e as Error & { code?: string };
    }

    expect(err?.code).toBe("must_change_password");
  });

  it("does not treat a plain 403 as must_change_password", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: "Superadmin only" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    let err: (Error & { code?: string }) | undefined;
    try {
      await me();
    } catch (e) {
      err = e as Error & { code?: string };
    }
    expect(err).toBeInstanceOf(Error);
    expect(err?.code).toBeUndefined();
  });

  it("always sends credentials: include", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ authenticated: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await me();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
