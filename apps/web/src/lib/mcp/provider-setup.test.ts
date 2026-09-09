import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { SUPPORTED_LOCALES, type Locale } from '@stem-brain/shared';
import { MESSAGE_CATALOGS, type MessageKey } from '@/i18n/messages';
import {
  MCP_PROVIDER_SETUP_GUIDES,
  MCP_TOKEN_ENVIRONMENT_VARIABLE,
  buildMcpProviderTokenSnippet,
  type McpProviderSetupId,
} from './provider-setup';

const productionEndpoint = 'https://www.girapphe.com/api/mcp';

function message(locale: Locale, key: MessageKey): string {
  const value = MESSAGE_CATALOGS[locale][key];
  if (typeof value !== 'string') {
    assert.fail(`${locale}.${key} must be a string message`);
  }
  return value;
}

function guideMessageKeys(guide: (typeof MCP_PROVIDER_SETUP_GUIDES)[McpProviderSetupId]): MessageKey[] {
  return [
    guide.nameKey,
    guide.nativeClientKey,
    guide.nativeAuthLabelKey,
    ...guide.nativeStepKeys,
    guide.availabilityKey,
    guide.tokenClientKey,
    guide.tokenSummaryKey,
    guide.officialGuideLabelKey,
    guide.tokenGuideLabelKey,
  ];
}

test('provider setup keeps native-app OAuth separate from PAT clients', () => {
  assert.deepEqual(Object.keys(MCP_PROVIDER_SETUP_GUIDES).sort(), ['chatgpt', 'claude']);

  for (const guide of Object.values(MCP_PROVIDER_SETUP_GUIDES)) {
    const nativeAuthLabel = message('en', guide.nativeAuthLabelKey);
    assert.match(nativeAuthLabel, /OAuth/u);
    assert.match(nativeAuthLabel, /do not paste a Girapphe PAT/u);
    assert.equal(guide.nativeStepKeys.length, 3);
    assert.match(guide.officialGuideUrl, /^https:\/\/(?:help\.openai\.com|support\.claude\.com)\//u);
    assert.match(guide.tokenGuideUrl, /^https:\/\/(?:platform\.openai\.com|code\.claude\.com)\//u);
  }

  const chatgptGuide = MCP_PROVIDER_SETUP_GUIDES.chatgpt;
  const chatgptFirstStep = message('en', chatgptGuide.nativeStepKeys[0]);
  const chatgptAvailability = message('en', chatgptGuide.availabilityKey);
  assert.equal(chatgptGuide.officialGuideUrl, 'https://help.openai.com/en/articles/12584461');
  assert.equal(chatgptGuide.tokenGuideUrl, 'https://platform.openai.com/docs/guides/tools-connectors-mcp');
  assert.match(chatgptFirstStep, /Business.*admin or owner/u);
  assert.match(chatgptFirstStep, /Enterprise\/Edu.*admin.*grants developer-mode access/u);
  assert.match(chatgptAvailability, /Business setup is admin\/owner-only/u);
  assert.match(chatgptAvailability, /Pro custom apps remain limited to read\/fetch/u);

  const claudeGuide = MCP_PROVIDER_SETUP_GUIDES.claude;
  const claudeFirstStep = message('en', claudeGuide.nativeStepKeys[0]);
  const claudeAvailability = message('en', claudeGuide.availabilityKey);
  assert.equal(claudeGuide.officialGuideUrl, 'https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp');
  assert.equal(claudeGuide.tokenGuideUrl, 'https://code.claude.com/docs/en/mcp');
  assert.match(claudeFirstStep, /Free, Pro, or Max.*Customize → Connectors/u);
  assert.match(claudeFirstStep, /Team or Enterprise.*Organization settings → Connectors/u);
  assert.match(claudeAvailability, /Free \(one custom connector\), Pro, Max, Team, and Enterprise/u);
});

test('provider setup has complete six-locale copy without losing plan, admin, or PAT boundaries', () => {
  const englishProviderKeys = (Object.keys(MESSAGE_CATALOGS.en) as MessageKey[])
    .filter((key) => key.startsWith('mcp.providerSetup.'))
    .sort();
  assert.equal(englishProviderKeys.length, 38);

  for (const locale of SUPPORTED_LOCALES) {
    const localeProviderKeys = (Object.keys(MESSAGE_CATALOGS[locale]) as MessageKey[])
      .filter((key) => key.startsWith('mcp.providerSetup.'))
      .sort();
    assert.deepEqual(localeProviderKeys, englishProviderKeys, `${locale} provider setup keys differ from English`);

    for (const guide of Object.values(MCP_PROVIDER_SETUP_GUIDES)) {
      for (const key of guideMessageKeys(guide)) {
        assert.match(key, /^mcp\.providerSetup\./u);
        assert.ok(message(locale, key).trim(), `${locale}.${key} must not be blank`);
      }
      assert.match(message(locale, guide.nativeAuthLabelKey), /OAuth/u);
      assert.match(message(locale, guide.nativeAuthLabelKey), /PAT/u);
      assert.match(message(locale, guide.tokenSummaryKey), /PAT/u);
    }

    const chatgptStep = message(locale, MCP_PROVIDER_SETUP_GUIDES.chatgpt.nativeStepKeys[0]);
    const chatgptAvailability = message(locale, MCP_PROVIDER_SETUP_GUIDES.chatgpt.availabilityKey);
    assert.match(chatgptStep, /Business/u);
    assert.match(chatgptStep, /Enterprise\/Edu/u);
    assert.match(chatgptStep, /Workspace settings → Apps → Create/u);
    assert.match(chatgptStep, /Settings → Apps → Advanced Settings/u);
    assert.match(chatgptAvailability, /Business/u);
    assert.match(chatgptAvailability, /Enterprise\/Edu/u);
    assert.match(chatgptAvailability, /Pro/u);

    const claudeStep = message(locale, MCP_PROVIDER_SETUP_GUIDES.claude.nativeStepKeys[0]);
    const claudeAvailability = message(locale, MCP_PROVIDER_SETUP_GUIDES.claude.availabilityKey);
    assert.match(claudeStep, /Free/u);
    assert.match(claudeStep, /Pro/u);
    assert.match(claudeStep, /Max/u);
    assert.match(claudeStep, /Team/u);
    assert.match(claudeStep, /Enterprise/u);
    assert.match(claudeStep, /Customize → Connectors/u);
    assert.match(claudeStep, /Organization settings → Connectors/u);
    assert.match(claudeAvailability, /Free/u);
    assert.match(claudeAvailability, /Pro/u);
    assert.match(claudeAvailability, /Max/u);
    assert.match(claudeAvailability, /Team/u);
    assert.match(claudeAvailability, /Enterprise/u);

    if (locale !== 'en') {
      assert.notEqual(
        chatgptAvailability,
        message('en', MCP_PROVIDER_SETUP_GUIDES.chatgpt.availabilityKey),
        `${locale} must localize ChatGPT availability guidance`,
      );
      assert.notEqual(
        claudeAvailability,
        message('en', MCP_PROVIDER_SETUP_GUIDES.claude.availabilityKey),
        `${locale} must localize Claude availability guidance`,
      );
    }
  }
});

test('ChatGPT token example uses the Responses API MCP authorization field', () => {
  const snippet = buildMcpProviderTokenSnippet('chatgpt', productionEndpoint);
  const tool = runInNewContext(`(${snippet})`, {
    process: { env: { [MCP_TOKEN_ENVIRONMENT_VARIABLE]: 'test-token' } },
  }) as Record<string, unknown>;

  assert.match(snippet, /type: "mcp"/u);
  assert.match(snippet, /server_url: "https:\/\/www\.girapphe\.com\/api\/mcp"/u);
  assert.match(snippet, new RegExp(`authorization: process\\.env\\.${MCP_TOKEN_ENVIRONMENT_VARIABLE}`, 'u'));
  assert.doesNotMatch(snippet, /headers|Authorization|Bearer/u);
  assert.match(snippet, /create_knowledge_bundle_drafts/u);
  assert.match(snippet, /get_topic_context/u);
  assert.match(snippet, /require_approval: "always"/u);
  assert.doesNotMatch(snippet, /girapphe_mcp_[A-Za-z0-9_-]+/u);
  assert.equal(tool.authorization, 'test-token');
  assert.equal('headers' in tool, false);
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

test('Settings renders the provider guide without receiving the raw PAT', () => {
  const componentSource = readFileSync(
    new URL('../../components/mcp-provider-setup-guide.tsx', import.meta.url),
    'utf8',
  );
  const connectionsSource = readFileSync(
    new URL('../../components/draft-review-mcp-connections.tsx', import.meta.url),
    'utf8',
  );
  const settingsSource = readFileSync(
    new URL('../../app/settings/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(componentSource, /name="mcp-provider-setup"/u);
  assert.match(componentSource, /type="radio"/u);
  assert.match(componentSource, /type="button"/u);
  assert.match(componentSource, /MCP_PROVIDER_SETUP_GUIDES/u);
  assert.match(componentSource, /useI18n\(\)/u);
  assert.match(componentSource, /<pre dir="ltr"/u);
  assert.doesNotMatch(componentSource, /Provider-specific setup|Use Girapphe with ChatGPT or Claude/u);
  assert.doesNotMatch(componentSource, /<section[^>]+(?:lang="en"|dir="ltr")/u);
  assert.match(settingsSource, /<DraftReviewMcpConnections tokens=\{tokens\} \/>/u);
  assert.match(connectionsSource, /<McpProviderSetupGuide endpointUrl=\{endpointUrl\} tokenReady=\{Boolean\(rawToken\)\} \/>/u);
  assert.doesNotMatch(connectionsSource, /<McpProviderSetupGuide[^>]+rawToken=/u);
  assert.match(
    connectionsSource,
    /setRawToken\(\{ id: result\.record\.id, value: result\.token, copied: false \}\)/u,
  );
  assert.match(
    connectionsSource,
    /try \{\s+await revokeMcpAccessToken\(formData\);\s+setRawToken\(\(current\) => current\?\.id === token\.id \? null : current\);\s+router\.refresh\(\);\s+\} catch \{\s+setError\(t\('mcp\.revokeError'\)\);/u,
  );
});
