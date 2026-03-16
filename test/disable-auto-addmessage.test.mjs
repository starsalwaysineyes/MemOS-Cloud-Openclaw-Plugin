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

function createEvent() {
  return {
    success: true,
    messages: [
      { role: "user", content: "hello" },
      { role: "assistant", content: "world" },
    ],
  };
}

test("disableAutoAddMessage defaults to false", () => {
  const cfg = buildConfig({});
  assert.equal(cfg.disableAutoAddMessage, false);
});

test("agent_end skips automatic addMessage when disableAutoAddMessage is enabled", async () => {
  const api = createApi({
    apiKey: "test-token",
    baseUrl: "https://example.com",
    disableAutoAddMessage: true,
  });
  plugin.register(api);

  const agentEnd = api.getHandler("agent_end");
  assert.equal(typeof agentEnd, "function");

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  };

  try {
    await agentEnd(createEvent(), { sessionKey: "session:disable-auto-add" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 0);
});

test("agent_end still calls addMessage by default", async () => {
  const api = createApi({
    apiKey: "test-token",
    baseUrl: "https://example.com",
  });
  plugin.register(api);

  const agentEnd = api.getHandler("agent_end");
  assert.equal(typeof agentEnd, "function");

  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    return {
      ok: true,
      json: async () => ({ ok: true }),
    };
  };

  try {
    await agentEnd(createEvent(), { sessionKey: "session:default-auto-add" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "https://example.com/add/message");
});
