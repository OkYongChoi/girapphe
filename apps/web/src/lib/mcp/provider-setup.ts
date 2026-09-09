import type { MessageKey } from '@/i18n/messages';

export const MCP_TOKEN_ENVIRONMENT_VARIABLE = 'GIRAPPHE_MCP_TOKEN';

export type McpProviderSetupId = 'chatgpt' | 'claude';
type McpProviderSetupMessageKey = Extract<MessageKey, `mcp.providerSetup.${string}`>;

export type McpProviderSetupGuide = {
  id: McpProviderSetupId;
  nameKey: McpProviderSetupMessageKey;
  nativeClientKey: McpProviderSetupMessageKey;
  nativeAuthLabelKey: McpProviderSetupMessageKey;
  nativeStepKeys: readonly [McpProviderSetupMessageKey, McpProviderSetupMessageKey, McpProviderSetupMessageKey];
  availabilityKey: McpProviderSetupMessageKey;
  tokenClientKey: McpProviderSetupMessageKey;
  tokenSummaryKey: McpProviderSetupMessageKey;
  officialGuideLabelKey: McpProviderSetupMessageKey;
  officialGuideUrl: string;
  tokenGuideLabelKey: McpProviderSetupMessageKey;
  tokenGuideUrl: string;
};

export const MCP_PROVIDER_SETUP_GUIDES: Record<McpProviderSetupId, McpProviderSetupGuide> = {
  chatgpt: {
    id: 'chatgpt',
    nameKey: 'mcp.providerSetup.chatgpt.name',
    nativeClientKey: 'mcp.providerSetup.chatgpt.nativeClient',
    nativeAuthLabelKey: 'mcp.providerSetup.chatgpt.nativeAuthLabel',
    nativeStepKeys: [
      'mcp.providerSetup.chatgpt.nativeStep1',
      'mcp.providerSetup.chatgpt.nativeStep2',
      'mcp.providerSetup.chatgpt.nativeStep3',
    ],
    availabilityKey: 'mcp.providerSetup.chatgpt.availability',
    tokenClientKey: 'mcp.providerSetup.chatgpt.tokenClient',
    tokenSummaryKey: 'mcp.providerSetup.chatgpt.tokenSummary',
    officialGuideLabelKey: 'mcp.providerSetup.chatgpt.officialGuideLabel',
    officialGuideUrl: 'https://help.openai.com/en/articles/12584461',
    tokenGuideLabelKey: 'mcp.providerSetup.chatgpt.tokenGuideLabel',
    tokenGuideUrl: 'https://platform.openai.com/docs/guides/tools-connectors-mcp',
  },
  claude: {
    id: 'claude',
    nameKey: 'mcp.providerSetup.claude.name',
    nativeClientKey: 'mcp.providerSetup.claude.nativeClient',
    nativeAuthLabelKey: 'mcp.providerSetup.claude.nativeAuthLabel',
    nativeStepKeys: [
      'mcp.providerSetup.claude.nativeStep1',
      'mcp.providerSetup.claude.nativeStep2',
      'mcp.providerSetup.claude.nativeStep3',
    ],
    availabilityKey: 'mcp.providerSetup.claude.availability',
    tokenClientKey: 'mcp.providerSetup.claude.tokenClient',
    tokenSummaryKey: 'mcp.providerSetup.claude.tokenSummary',
    officialGuideLabelKey: 'mcp.providerSetup.claude.officialGuideLabel',
    officialGuideUrl: 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp',
    tokenGuideLabelKey: 'mcp.providerSetup.claude.tokenGuideLabel',
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
      `  authorization: process.env.${MCP_TOKEN_ENVIRONMENT_VARIABLE},`,
      '  allowed_tools: [',
      '    "create_knowledge_bundle_drafts",',
      '    "create_card_drafts",',
      '    "get_topic_context",',
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
