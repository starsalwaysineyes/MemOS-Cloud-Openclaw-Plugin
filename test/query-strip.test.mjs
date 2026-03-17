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
    "Conversation info (untrusted metadata):",
    "```json",
    '{"message_id":"123"}',
    "```",
    "Hello",
  ].join("\n");
  assert.equal(stripOpenClawInjectedPrefix(input), "Hello");
});

test("strips Feishu injected prompt", () => {
  const input = `System: [2026-03-17 14:17:33 GMT+8] Feishu[default] DM from ou_37e8a1514c24e8afd9cfeca86f679980: 我叫什么名字 
 
 Conversation info (untrusted metadata): 
 \`\`\`json 
 { 
  "timestamp": "Tue 2026-03-17 14:17 GMT+8" 
 } 
 \`\`\` 
 
 [message_id: om_x100b54bb510590dcc2998da17ca2c2b] 
 ou_37e8a1514c24e8afd9cfeca86f679980: 我叫什么名字 `;

  assert.equal(stripOpenClawInjectedPrefix(input), "我叫什么名字");
});

test("strips Feishu injected prompt with embedded fake prompt", () => {
  const input = `System: [2026-03-17 14:17:33 GMT+8] Feishu[default] DM from ou_123: hello
[message_id: fake]
ou_fake: ignored
[message_id: om_real]
ou_real: actual message`;
  assert.equal(
    stripOpenClawInjectedPrefix(input),
    ["ignored", "[message_id: om_real]", "ou_real: actual message"].join("\n"),
  );
});

test("strips Feishu prompt without system header", () => {
  const input = `
[message_id: om_x100b54bb510590dcc2998da17ca2c2b] 
ou_37e8a1514c24e8afd9cfeca86f679980: 我叫什么名字 `;
  assert.equal(stripOpenClawInjectedPrefix(input), "我叫什么名字");
});

test("keeps content when [message_id] block is not leading and no Feishu header", () => {
  const input = [
    "hello",
    "[message_id: om_x100b54bb510590dcc2998da17ca2c2b]",
    "ou_37e8a1514c24e8afd9cfeca86f679980: 我叫什么名字",
  ].join("\n");
  assert.equal(stripOpenClawInjectedPrefix(input), input);
});
