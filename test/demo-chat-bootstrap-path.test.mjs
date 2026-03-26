import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readDemoFile(relativePath) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

test('demo-chat chat page bootstraps stores from idframework', () => {
  const html = readDemoFile('demo-chat/chat.html');

  assert.match(html, /<script src="\.\.\/idframework\/bootstrap-stores\.js"><\/script>/);
  assert.doesNotMatch(html, /demo-buzz\/utils\/bootstrap-stores\.js/);
});

test('demo-chat groupchat page bootstraps stores from idframework', () => {
  const html = readDemoFile('demo-chat/groupchat.html');

  assert.match(html, /<script src="\.\.\/idframework\/bootstrap-stores\.js"><\/script>/);
  assert.doesNotMatch(html, /demo-buzz\/utils\/bootstrap-stores\.js/);
});
