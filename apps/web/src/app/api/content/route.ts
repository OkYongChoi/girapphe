import { NextRequest } from 'next/server';
import { handlePublicContentRequest } from '@/lib/public-content-api';

export async function GET(request: NextRequest) {
  return handlePublicContentRequest(request);
}
