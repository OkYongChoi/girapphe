import { expect, test, type Page } from '@playwright/test';

type MockTool = {
  name: string;
  inputSchema: Record<string, unknown>;
  execute(
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ): unknown | Promise<unknown>;
};

async function installWebMcpMock(page: Page) {
  await page.addInitScript(() => {
    type BrowserTool = {
      name: string;
      inputSchema: Record<string, unknown>;
      execute(
        input: Record<string, unknown>,
        options: { signal: AbortSignal },
      ): unknown | Promise<unknown>;
    };

    const registrations = new Map<string, BrowserTool>();
    const modelContext = {
      registerTool(tool: BrowserTool, options?: { signal?: AbortSignal }) {
        registrations.set(tool.name, tool);
        options?.signal?.addEventListener(
          'abort',
          () => registrations.delete(tool.name),
          { once: true },
        );
      },
    };

    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: modelContext,
    });
    Object.defineProperty(window, '__girappheWebMcpTools', {
      configurable: true,
      value: registrations,
    });
  });
}

async function registeredToolNames(page: Page) {
  return page.evaluate(() => {
    const registrations = (window as unknown as {
      __girappheWebMcpTools: Map<string, MockTool>;
    }).__girappheWebMcpTools;
    return Array.from(registrations.keys()).sort();
  });
}

async function waitForTool(page: Page, name: string) {
  await expect.poll(async () => (await registeredToolNames(page)).includes(name)).toBe(true);
}

async function executeTool(
  page: Page,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  return page.evaluate(async ({ toolName, toolInput }) => {
    const registrations = (window as unknown as {
      __girappheWebMcpTools: Map<string, MockTool>;
    }).__girappheWebMcpTools;
    const tool = registrations.get(toolName);
    if (!tool) throw new Error(`Missing WebMCP tool: ${toolName}`);
    return tool.execute(toolInput, { signal: new AbortController().signal });
  }, { toolName: name, toolInput: input });
}

test.describe('WebMCP progressive enhancement', () => {
  test('search_knowledge applies local filters and returns public catalog fields only', async ({ page }) => {
    await installWebMcpMock(page);
    await page.goto('/knowledge');
    await waitForTool(page, 'search_knowledge');

    expect(await registeredToolNames(page)).toEqual(['search_knowledge']);

    const result = await executeTool(page, 'search_knowledge', {
      query: '__webmcp_no_match__',
      domain: 'all',
      status: 'known',
      added_within: 'all',
    }) as {
      ok: boolean;
      result_scope: string;
      status_filter_applied_to_output: boolean;
      results: Array<Record<string, unknown>>;
    };

    expect(result.ok).toBe(true);
    expect(result.result_scope).toBe('public_catalog');
    expect(result.status_filter_applied_to_output).toBe(false);
    expect(result.results).toHaveLength(0);
    for (const card of result.results) {
      expect(Object.keys(card).sort()).toEqual(['domain', 'id', 'title']);
    }

    await expect(page.getByRole('textbox', { name: /Search concepts, terms, or #tags/i }))
      .toHaveValue('__webmcp_no_match__');
  });

  test('prepare_review_session requires an explicit mode and returns no learning counts', async ({ page }) => {
    await installWebMcpMock(page);
    await page.goto('/practice?mode=new');
    await waitForTool(page, 'prepare_review_session');

    const schema = await page.evaluate(() => {
      const registrations = (window as unknown as {
        __girappheWebMcpTools: Map<string, MockTool>;
      }).__girappheWebMcpTools;
      return registrations.get('prepare_review_session')?.inputSchema;
    });
    expect(schema).toMatchObject({ required: ['mode'] });

    const invalid = await executeTool(page, 'prepare_review_session', {});
    expect(invalid).toMatchObject({ status: 'invalid_request' });

    const prepared = await executeTool(page, 'prepare_review_session', { mode: 'new' });
    expect(prepared).toEqual({ status: 'prepared', mode: 'new' });
  });
});
