import { hasValidClerkConfig } from '@/lib/clerk-env';

export const dynamic = 'force-dynamic';

const metadataCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export async function GET(request: Request) {
  if (!hasValidClerkConfig()) {
    return Response.json(
      { error: 'oauth_unavailable' },
      {
        status: 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) throw new Error('Missing NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');

  const { generateClerkProtectedResourceMetadata } = await import('@clerk/mcp-tools/server');
  const metadata = generateClerkProtectedResourceMetadata({
    publishableKey,
    resourceUrl: new URL(request.url).origin,
    properties: { scopes_supported: ['profile'] },
  });
  return Response.json(metadata, {
    headers: {
      'Cache-Control': 'max-age=3600',
      'Content-Type': 'application/json',
      ...metadataCorsHeaders,
    },
  });
}

export function OPTIONS() {
  return new Response(null, { status: 200, headers: metadataCorsHeaders });
}
