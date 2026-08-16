import assert from 'node:assert/strict';
import test from 'node:test';

const TEST_PUBLISHABLE_KEY = 'pk_test_Y2xlcmsudGVzdCQ';
const TEST_SECRET_KEY = 'sk_test_12345678901234567890';

test('serves Clerk OAuth metadata without the client-side MCP bundle', async () => {
  const [authorizationRoute, protectedResourceRoute] = await Promise.all([
    import('@/app/.well-known/oauth-authorization-server/route'),
    import('@/app/.well-known/oauth-protected-resource/mcp/route'),
  ]);
  const previousPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const previousSecretKey = process.env.CLERK_SECRET_KEY;
  const previousFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = TEST_PUBLISHABLE_KEY;
  process.env.CLERK_SECRET_KEY = TEST_SECRET_KEY;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), 'https://clerk.test/.well-known/oauth-authorization-server');
    return Response.json({ issuer: 'https://clerk.test' });
  };

  try {
    const authorization = await authorizationRoute.GET();
    assert.equal(authorization.status, 200);
    assert.equal(authorization.headers.get('access-control-allow-origin'), '*');
    assert.equal(authorization.headers.get('cache-control'), 'max-age=3600');
    assert.deepEqual(await authorization.json(), { issuer: 'https://clerk.test' });

    const protectedResource = await protectedResourceRoute.GET(
      new Request('https://girapphe.example/.well-known/oauth-protected-resource/mcp')
    );
    assert.equal(protectedResource.status, 200);
    assert.equal(protectedResource.headers.get('access-control-allow-origin'), '*');
    assert.equal(protectedResource.headers.get('cache-control'), 'max-age=3600');
    const protectedPayload = await protectedResource.json() as {
      resource?: string;
      authorization_servers?: string[];
      scopes_supported?: string[];
    };
    assert.equal(protectedPayload.resource, 'https://girapphe.example');
    assert.deepEqual(protectedPayload.authorization_servers, ['https://clerk.test']);
    assert.deepEqual(protectedPayload.scopes_supported, ['profile']);

    assert.equal(authorizationRoute.OPTIONS().status, 200);
    assert.equal(protectedResourceRoute.OPTIONS().status, 200);

    delete process.env.CLERK_SECRET_KEY;
    const unavailable = await authorizationRoute.GET();
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await unavailable.json(), { error: 'oauth_unavailable' });
  } finally {
    if (previousPublishableKey === undefined) {
      delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = previousPublishableKey;
    }
    if (previousSecretKey === undefined) {
      delete process.env.CLERK_SECRET_KEY;
    } else {
      process.env.CLERK_SECRET_KEY = previousSecretKey;
    }
    globalThis.fetch = previousFetch;
  }
});
