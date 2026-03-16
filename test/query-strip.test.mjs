import test from "node:test";
import assert from "node:assert/strict";

import {
  USER_QUERY_MARKER,
  stripOpenClawInjectedPrefix,
} from "../lib/memos-cloud-api.js";

test("leaves plain user text unchanged", () => {
  assert.equal(stripOpenClawInjectedPrefix("直接就是用户问题"), "直接就是用户问题");
});

test("strips MemOS recall marker and keeps original query", () => {
  const input = `<memories>\n  <facts>\n  </facts>\n</memories>\n\n${USER_QUERY_MARKER}真正的问题`;
  assert.equal(stripOpenClawInjectedPrefix(input), "真正的问题");
});

test("strips OpenClaw inbound metadata prefix blocks", () => {
  const input = [
    "Conversation info (untrusted metadata):",
    "```json",
    '{"message_id":"123"}',
    "```",
    "",
    "Sender (untrusted metadata):",
    "```json",
    '{"label":"Aurora"}',
    "```",
    "",
    "帮我看下这个问题",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), "帮我看下这个问题");
});

test("strips recall marker and inbound metadata together", () => {
  const input = [
    "<memories>",
    "  <facts>",
    "  </facts>",
    "</memories>",
    "",
    `${USER_QUERY_MARKER}Conversation info (untrusted metadata):`,
    "```json",
    '{"message_id":"123","history_count":1}',
    "```",
    "",
    "Chat history since last reply (untrusted, for context):",
    "```json",
    '[{"sender":"Aurora","body":"上一条"}]',
    "```",
    "",
    "继续",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), "继续");
});

test("keeps content when metadata block is malformed", () => {
  const input = [
    "Conversation info (untrusted metadata):",
    "not-a-json-fence",
    "真正的问题",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), input);
});

test("keeps content unchanged when sentinel appears in normal body", () => {
  const input = [
    "请原样解释下面这段文本：",
    "Conversation info (untrusted metadata):",
    "```json",
    '{"message_id":"123"}',
    "```",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), input);
});

test("strips valid prefix even if body starts with a sentinel-like line", () => {
  const input = [
    "Sender (untrusted metadata):",
    "```json",
    '{"label":"Aurora"}',
    "```",
    "",
    "Sender (untrusted metadata):",
    "这行是正文，不是 OpenClaw 注入块",
  ].join("\n");

  assert.equal(
    stripOpenClawInjectedPrefix(input),
    ["Sender (untrusted metadata):", "这行是正文，不是 OpenClaw 注入块"].join("\n"),
  );
});

test("supports leading blank lines before inbound metadata", () => {
  const input = [
    "",
    "",
    "Conversation info (untrusted metadata):",
    "```json",
    '{"message_id":"123"}',
    "```",
    "",
    "真正的问题",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), "真正的问题");
});

test("supports windows newlines", () => {
  const input =
    "Conversation info (untrusted metadata):\r\n```json\r\n{\"message_id\":\"123\"}\r\n```\r\n\r\n继续";

  assert.equal(stripOpenClawInjectedPrefix(input), "继续");
});

test("strips gateway-client sender block and leading weekday timestamp envelope", () => {
  const input = [
    "Sender (untrusted metadata):",
    "```json",
    '{"label":"openclaw-tui (gateway-client)","id":"gateway-client"}',
    "```",
    "",
    "[Mon 2026-03-16 14:27 GMT+8] What is Melanie's hand-painted bowl a reminder of?",
  ].join("\n");

  assert.equal(
    stripOpenClawInjectedPrefix(input),
    "What is Melanie's hand-painted bowl a reminder of?",
  );
});

test("strips leading pm-on-date envelope after inbound metadata", () => {
  const input = [
    "Sender (untrusted metadata):",
    "```json",
    '{"label":"openclaw-tui (gateway-client)","id":"gateway-client"}',
    "```",
    "",
    "[06:18 PM on 07 March, 2026]: 继续",
  ].join("\n");

  assert.equal(stripOpenClawInjectedPrefix(input), "继续");
});

test("keeps bracketed content when it is not a recognized timestamp envelope", () => {
  const input = "[Important] What is Melanie's hand-painted bowl a reminder of?";
  assert.equal(stripOpenClawInjectedPrefix(input), input);
});
