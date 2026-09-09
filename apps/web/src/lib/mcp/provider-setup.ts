export const MCP_TOKEN_ENVIRONMENT_VARIABLE = 'GIRAPPHE_MCP_TOKEN';

export type McpProviderSetupId = 'chatgpt' | 'claude';

export type McpProviderSetupGuide = {
  id: McpProviderSetupId;
  name: string;
  nativeClient: string;
  nativeAuthLabel: string;
  nativeSteps: readonly string[];
  availability: string;
  tokenClient: string;
  tokenSummary: string;
  officialGuideLabel: string;
  officialGuideUrl: string;
  tokenGuideLabel: string;
  tokenGuideUrl: string;
};

export const MCP_PROVIDER_SETUP_GUIDES: Record<McpProviderSetupId, McpProviderSetupGuide> = {
  chatgpt: {
    id: 'chatgpt',
    name: 'ChatGPT',
    nativeClient: 'ChatGPT web app',
    nativeAuthLabel: 'Connect with OAuth — do not paste a Girapphe PAT',
    nativeSteps: [
      'Enable developer mode, then open Settings → Apps → Create (or Workspace settings → Apps → Create).',
      'Enter the Girapphe MCP endpoint, choose OAuth, and scan the available tools.',
      'Finish the Girapphe sign-in prompt. In a new chat, select the Girapphe app before asking it to create drafts from your explicit selection.',
    ],
    availability: 'ChatGPT draft creation needs full MCP write support, currently available on Business and Enterprise/Edu web workspaces. Pro custom apps are limited to read/fetch actions.',
    tokenClient: 'OpenAI Responses API',
    tokenSummary: 'Use the PAT as an Authorization header on the remote MCP tool. Keep it in a server-side secret or environment variable, never in browser code.',
    officialGuideLabel: 'Official ChatGPT app setup',
    officialGuideUrl: 'https://help.openai.com/en/articles/12584461',
    tokenGuideLabel: 'Official OpenAI remote MCP reference',
    tokenGuideUrl: 'https://platform.openai.com/docs/guides/tools-connectors-mcp',
  },
  claude: {
    id: 'claude',
    name: 'Claude',
    nativeClient: 'Claude web or Desktop',
    nativeAuthLabel: 'Connect with OAuth — do not paste a Girapphe PAT',
    nativeSteps: [
      'Open Settings → Connectors and choose Add custom connector.',
      'Enter the Girapphe MCP endpoint, add the connector, and select Connect.',
      'Finish the Girapphe sign-in prompt. Enable the Girapphe tools for the current conversation before sending an explicit selection.',
    ],
    availability: 'Remote custom connectors are currently available on Claude Pro, Max, Team, and Enterprise. Team and Enterprise owners must enable the connector for their organization first.',
    tokenClient: 'Claude Code',
    tokenSummary: 'Claude Code accepts a custom Authorization header. This user-scoped setup stores only an environment-variable reference instead of putting the PAT in project configuration.',
    officialGuideLabel: 'Official Claude connector setup',
    officialGuideUrl: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    tokenGuideLabel: 'Official Claude Code MCP reference',
    tokenGuideUrl: 'https://code.claude.com/docs/en/mcp',
  },
};

function normalizeEndpointUrl(endpointUrl: string): string {
  const normalized = endpointUrl.trim();
  if (!normalized) return '/api/mcp';

  try {
    const url = new URL(normalized);
    const isLocalHttp = url.protocol === 'http:'
      && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
    if (url.protocol !== 'https:' && !isLocalHttp) {
      return '/api/mcp';
    }
    return url.toString();
  } catch {
    return normalized.startsWith('/') ? normalized : '/api/mcp';
  }
}

export function buildMcpProviderTokenSnippet(
  provider: McpProviderSetupId,
  endpointUrl: string,
): string {
  const endpoint = normalizeEndpointUrl(endpointUrl);

  if (provider === 'chatgpt') {
    return [
      '{',
      '  type: "mcp",',
      '  server_label: "girapphe",',
      `  server_url: ${JSON.stringify(endpoint)},`,
      '  headers: {',
      `    Authorization: \`Bearer \${process.env.${MCP_TOKEN_ENVIRONMENT_VARIABLE}}\`,`,
      '  },',
      '  allowed_tools: [',
      '    "create_knowledge_bundle_drafts",',
      '    "create_card_drafts",',
      '  ],',
      '  require_approval: "always",',
      '}',
    ].join('\n');
  }

  const configuration = JSON.stringify({
    type: 'http',
    url: endpoint,
    headers: {
      Authorization: `Bearer \${${MCP_TOKEN_ENVIRONMENT_VARIABLE}}`,
    },
  });

  return `claude mcp add-json girapphe '${configuration}' --scope user`;
}
