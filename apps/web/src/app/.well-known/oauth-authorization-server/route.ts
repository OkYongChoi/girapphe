import {
  authServerMetadataHandlerClerk,
  metadataCorsOptionsRequestHandler,
} from '@clerk/mcp-tools/next';
import { hasValidClerkConfig } from '@/lib/clerk-env';

export const dynamic = 'force-dynamic';

const handler = authServerMetadataHandlerClerk();
const corsHandler = metadataCorsOptionsRequestHandler();

export async function GET() {
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
  return handler();
}

export const OPTIONS = corsHandler;
