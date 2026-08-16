import {
  metadataCorsOptionsRequestHandler,
  protectedResourceHandlerClerk,
} from '@clerk/mcp-tools/next';
import { hasValidClerkConfig } from '@/lib/clerk-env';

export const dynamic = 'force-dynamic';

const handler = protectedResourceHandlerClerk({
  scopes_supported: ['profile'],
});
const corsHandler = metadataCorsOptionsRequestHandler();

export function GET(request: Request) {
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
  return handler(request);
}

export const OPTIONS = corsHandler;
