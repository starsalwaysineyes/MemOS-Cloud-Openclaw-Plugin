import test from "node:test";
import assert from "node:assert/strict";

import plugin from "../index.js";
import { buildConfig } from "../lib/memos-cloud-api.js";

function createApi(pluginConfig = {}) {
  const handlers = new Map();
  return {
    pluginConfig,
    config: {},
    logger: {
      info() {},
      warn() {},
    },
    on(eventName, handler) {
      handlers.set(eventName, handler);
    },
    registerHook() {},
    getHandler(eventName) {
      return handlers.get(eventName);
    },
  };
}

test("disableAutoSearchMemory defaults to false", () => {
  const cfg = buildConfig({});
  assert.equal(cfg.disableAutoSearchMemory, false);
});

test("before_agent_start skips automatic searchMemory when disableAutoSearchMemory is enabled", async () => {
  const api = createApi({
    apiKey: "test-token",
    baseUrl: "https://example.com",
    disableAutoSearchMemory: true,
  });
  plugin.register(api);

  const beforeAgentStart = api.getHandler("before_agent_start");
  assert.equal(typeof beforeAgentStart, "function");

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      json: async () => ({ data: null }),
    };
  };

  try {
    await beforeAgentStart({ prompt: "hello" }, { sessionKey: "session:disable-auto-search" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 0);
});

test("before_agent_start still calls searchMemory by default", async () => {
  const api = createApi({
    apiKey: "test-token",
    baseUrl: "https://example.com",
  });
  plugin.register(api);

  const beforeAgentStart = api.getHandler("before_agent_start");
  assert.equal(typeof beforeAgentStart, "function");

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      json: async () => ({ data: null }),
    };
  };

  try {
    await beforeAgentStart({ prompt: "hello" }, { sessionKey: "session:default-auto-search" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://example.com/search/memory");
});
