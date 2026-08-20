import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWebMcpModelContext,
  registerWebMcpTools,
  selectWebMcpModelContext,
  type WebMcpEnvironment,
  type WebMcpTool,
} from './webmcp';

const TOOL: WebMcpTool = {
  name: 'find_card',
  title: 'Find card',
  description: 'Find a knowledge card by keyword.',
  inputSchema: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  annotations: { readOnlyHint: true },
  execute: ({ query }) => ({ query }),
};

test('selects the current document context before the navigator compatibility fallback', () => {
  const documentContext = { registerTool() {} };
  const navigatorContext = { registerTool() {} };

  assert.equal(selectWebMcpModelContext(documentContext, navigatorContext), documentContext);
  assert.equal(selectWebMcpModelContext(null, navigatorContext), navigatorContext);
  assert.equal(selectWebMcpModelContext(undefined, undefined), null);
});

test('resolves model context without reading browser globals in Node', () => {
  const navigatorContext = { registerTool() {} };
  const environment: WebMcpEnvironment = {
    navigator: { modelContext: navigatorContext },
  };

  assert.equal(getWebMcpModelContext(environment), navigatorContext);
  assert.equal(getWebMcpModelContext({}), null);
});

test('is a progressive no-op when WebMCP is unavailable', () => {
  const dispose = registerWebMcpTools([TOOL], {});

  assert.doesNotThrow(dispose);
  assert.doesNotThrow(dispose);
});

test('registers tools with one signal and aborts the full lifecycle on cleanup', () => {
  const activeTools = new Set<string>();
  const signals: AbortSignal[] = [];
  const tools = [TOOL, { ...TOOL, name: 'open_card', title: 'Open card' }];
  const environment: WebMcpEnvironment = {
    document: {
      modelContext: {
        registerTool(tool, { signal } = {}) {
          assert.ok(signal);
          activeTools.add(tool.name);
          signals.push(signal);
          signal.addEventListener('abort', () => activeTools.delete(tool.name), { once: true });
        },
      },
    },
  };

  const dispose = registerWebMcpTools(tools, environment);

  assert.deepEqual([...activeTools], ['find_card', 'open_card']);
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
  assert.equal(signals[0].aborted, false);

  dispose();

  assert.equal(signals[0].aborted, true);
  assert.deepEqual([...activeTools], []);
  assert.doesNotThrow(dispose);
});
