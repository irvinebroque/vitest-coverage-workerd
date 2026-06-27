import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker, { messageForPath } from "../src/index";

describe("messageForPath", () => {
  it("returns a health check response", () => {
    expect(messageForPath("/health", env)).toBe("ok");
  });

  it("uses the configured Worker env var for other paths", () => {
    expect(messageForPath("/hello", env)).toBe("Hello from workerd: /hello");
  });
});

describe("worker fetch", () => {
  it("can unit test the module Worker fetch handler in workerd", async () => {
    const request = new Request("https://example.com/unit");
    const ctx = createExecutionContext();

    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    await expect(response.json()).resolves.toMatchObject({
      message: "Hello from workerd: /unit",
      runtime: "Cloudflare-Workers",
    });
  });

  it("can integration test the configured main Worker export", async () => {
    const response = await exports.default.fetch("https://example.com/health");

    await expect(response.json()).resolves.toMatchObject({
      message: "ok",
      runtime: "Cloudflare-Workers",
    });
  });
});
