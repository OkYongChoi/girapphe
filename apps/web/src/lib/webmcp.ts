'use client';

import { useEffect } from 'react';

export type WebMcpTool = {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly annotations?: Readonly<{
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  }>;
  readonly execute: (
    input: Record<string, unknown>,
    options: Readonly<{ signal: AbortSignal }>,
  ) => unknown | Promise<unknown>;
};

type WebMcpModelContext = {
  registerTool(
    tool: WebMcpTool,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): void | Promise<void>;
};

export type WebMcpEnvironment = {
  readonly document?: { readonly modelContext?: WebMcpModelContext | null };
  readonly navigator?: { readonly modelContext?: WebMcpModelContext | null };
};

export function selectWebMcpModelContext(
  documentContext: WebMcpModelContext | null | undefined,
  navigatorContext: WebMcpModelContext | null | undefined,
): WebMcpModelContext | null {
  return documentContext ?? navigatorContext ?? null;
}

export function getWebMcpModelContext(
  environment: WebMcpEnvironment = globalThis as unknown as WebMcpEnvironment,
): WebMcpModelContext | null {
  return selectWebMcpModelContext(
    environment.document?.modelContext,
    environment.navigator?.modelContext,
  );
}

function reportRegistrationError(tool: WebMcpTool, error: unknown): void {
  console.warn(`[WebMCP] Failed to register tool "${tool.name}".`, error);
}

export function registerWebMcpTools(
  tools: readonly WebMcpTool[],
  environment?: WebMcpEnvironment,
): () => void {
  const modelContext = getWebMcpModelContext(environment);
  if (!modelContext || tools.length === 0) return () => undefined;

  const controller = new AbortController();

  for (const tool of tools) {
    try {
      const registration = modelContext.registerTool(tool, { signal: controller.signal });
      if (registration) {
        void registration.catch((error: unknown) => {
          if (!controller.signal.aborted) reportRegistrationError(tool, error);
        });
      }
    } catch (error) {
      reportRegistrationError(tool, error);
    }
  }

  return () => controller.abort();
}

export function useWebMcpTools(tools: readonly WebMcpTool[]): void {
  useEffect(() => registerWebMcpTools(tools), [tools]);
}
