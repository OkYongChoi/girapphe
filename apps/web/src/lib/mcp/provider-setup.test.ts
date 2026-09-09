import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MCP_PROVIDER_SETUP_GUIDES,
  MCP_TOKEN_ENVIRONMENT_VARIABLE,
  buildMcpProviderTokenSnippet,
} from './provider-setup';

const productionEndpoint = 'https://www.girapphe.com/api/mcp';

test('provider setup keeps native-app OAuth separate from PAT clients', () => {
  assert.deepEqual(Object.keys(MCP_PROVIDER_SETUP_GUIDES).sort(), ['chatgpt', 'claude']);

  for (const guide of Object.values(MCP_PROVIDER_SETUP_GUIDES)) {
    assert.match(guide.nativeAuthLabel, /OAuth/u);
    assert.match(guide.nativeAuthLabel, /do not paste a Girapphe PAT/u);
    assert.equal(guide.nativeSteps.length, 3);
    assert.match(guide.officialGuideUrl, /^https:\/\/(?:help\.openai\.com|support\.claude\.com)\//u);
    assert.match(guide.tokenGuideUrl, /^https:\/\/(?:platform\.openai\.com|code\.claude\.com)\//u);
  }

  const claudeGuide = MCP_PROVIDER_SETUP_GUIDES.claude;
  assert.match(claudeGuide.nativeSteps[0] ?? '', /Free, Pro, or Max.*Customize → Connectors/u);
  assert.match(claudeGuide.nativeSteps[0] ?? '', /Team or Enterprise.*Organization settings → Connectors/u);
  assert.match(claudeGuide.availability, /Free \(one custom connector\), Pro, Max, Team, and Enterprise/u);
});

test('ChatGPT token example uses a server-side OpenAI MCP Authorization header', () => {
  const snippet = buildMcpProviderTokenSnippet('chatgpt', productionEndpoint);

  assert.match(snippet, /type: "mcp"/u);
  assert.match(snippet, /server_url: "https:\/\/www\.girapphe\.com\/api\/mcp"/u);
  assert.match(snippet, new RegExp(`process\\.env\\.${MCP_TOKEN_ENVIRONMENT_VARIABLE}`, 'u'));
  assert.match(snippet, /create_knowledge_bundle_drafts/u);
  assert.match(snippet, /get_topic_context/u);
  assert.match(snippet, /require_approval: "always"/u);
  assert.doesNotMatch(snippet, /girapphe_mcp_[A-Za-z0-9_-]+/u);
});

test('Claude token example configures Streamable HTTP without embedding a PAT', () => {
  const snippet = buildMcpProviderTokenSnippet('claude', productionEndpoint);

  assert.match(snippet, /claude mcp add-json girapphe/u);
  assert.match(snippet, /"type":"http"/u);
  assert.match(snippet, /https:\/\/www\.girapphe\.com\/api\/mcp/u);
  assert.ok(snippet.includes(`Bearer \${${MCP_TOKEN_ENVIRONMENT_VARIABLE}}`));
  assert.match(snippet, /--scope user$/u);
  assert.doesNotMatch(snippet, /girapphe_mcp_[A-Za-z0-9_-]+/u);
});

test('provider snippets reject unsafe absolute endpoint schemes', () => {
  const snippet = buildMcpProviderTokenSnippet('chatgpt', 'javascript:alert(1)');

  assert.match(snippet, /server_url: "\/api\/mcp"/u);
  assert.doesNotMatch(snippet, /javascript:/u);
});

test('Knowledge Inbox renders the provider guide without receiving the raw PAT', () => {
  const componentSource = readFileSync(
    new URL('../../components/mcp-provider-setup-guide.tsx', import.meta.url),
    'utf8',
  );
  const connectionsSource = readFileSync(
    new URL('../../components/draft-review-mcp-connections.tsx', import.meta.url),
    'utf8',
  );

  assert.match(componentSource, /name="mcp-provider-setup"/u);
  assert.match(componentSource, /MCP_PROVIDER_SETUP_GUIDES/u);
  assert.match(connectionsSource, /<McpProviderSetupGuide endpointUrl=\{endpointUrl\} tokenReady=\{Boolean\(rawToken\)\} \/>/u);
  assert.doesNotMatch(connectionsSource, /<McpProviderSetupGuide[^>]+rawToken=/u);
});
