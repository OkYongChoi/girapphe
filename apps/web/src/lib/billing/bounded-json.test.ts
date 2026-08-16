import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedBytes, readBoundedJson } from './bounded-json';

function streamingRequest(chunks: string[], headers?: HeadersInit) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Request('https://girapphe.com/api/billing/toss/prepare', {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

test('bounded JSON parser accepts a valid streamed body at the exact byte limit', async () => {
  const padding = 'x'.repeat(4096 - new TextEncoder().encode('{"padding":""}').byteLength);
  const body = JSON.stringify({ padding });
  assert.equal(new TextEncoder().encode(body).byteLength, 4096);
  const result = await readBoundedJson(
    streamingRequest([body.slice(0, 2048), body.slice(2048)]),
    4096,
  );
  assert.deepEqual(result, { ok: true, value: { padding } });
});

test('bounded JSON parser rejects an oversized declared body before parsing', async () => {
  const result = await readBoundedJson(
    streamingRequest(['{}'], { 'Content-Length': '4097' }),
    4096,
  );
  assert.deepEqual(result, { ok: false, reason: 'too_large' });
});

test('bounded JSON parser rejects 4097 actual bytes without a length header', async () => {
  const result = await readBoundedJson(
    streamingRequest(['x'.repeat(2048), 'x'.repeat(2049)]),
    4096,
  );
  assert.deepEqual(result, { ok: false, reason: 'too_large' });
});

test('bounded JSON parser rejects chunked bytes beyond the limit despite a false length', async () => {
  const result = await readBoundedJson(
    streamingRequest(['{"plan":"', 'monthly', '"}'], { 'Content-Length': '2' }),
    8,
  );
  assert.deepEqual(result, { ok: false, reason: 'too_large' });
});

test('bounded JSON parser rejects malformed JSON within the limit', async () => {
  const result = await readBoundedJson(streamingRequest(['{"plan":']), 4096);
  assert.deepEqual(result, { ok: false, reason: 'invalid_json' });
});

test('bounded byte reader preserves exact webhook bytes and rejects understated bodies', async () => {
  const accepted = await readBoundedBytes(streamingRequest(['raw-', 'signature-bytes']), 19);
  assert.equal(accepted.ok, true);
  if (accepted.ok) assert.equal(Buffer.from(accepted.value).toString('utf8'), 'raw-signature-bytes');

  const rejected = await readBoundedBytes(
    streamingRequest(['12345678', '9'], { 'Content-Length': '1' }),
    8,
  );
  assert.deepEqual(rejected, { ok: false, reason: 'too_large' });
});
