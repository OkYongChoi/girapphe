import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  QuizRateLimitError,
  UnknownGraphNodeError,
  submitDbQuizResult,
} from '@/lib/knowledge-graph-db';
import {
  InvalidJsonBodyError,
  MAX_QUIZ_REQUEST_BYTES,
  RequestBodyTooLargeError,
  readBoundedJsonBody,
} from '@/lib/bounded-json-body';

const MAX_NODE_ID_LENGTH = 100;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await readBoundedJsonBody(request, MAX_QUIZ_REQUEST_BYTES);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'JSON object required' }, { status: 400 });
    }

    const { node_id, result } = body as { node_id?: unknown; result?: unknown };

    if (typeof node_id !== 'string' || !node_id.trim() || node_id.length > MAX_NODE_ID_LENGTH || result === undefined) {
      return NextResponse.json(
        { error: 'node_id and result are required' },
        { status: 400 }
      );
    }

    if (typeof result !== 'number' || ![0, 0.5, 1].includes(result)) {
      return NextResponse.json(
        { error: 'result must be 0, 0.5, or 1' },
        { status: 400 }
      );
    }

    const response = await submitDbQuizResult(
      user.id,
      node_id.trim(),
      result as 0 | 0.5 | 1
    );

    return NextResponse.json({
      success: response.success,
      node: response.node,
      knowledge_state: response.node ? (response.node.knowledge >= 0.75 ? 1 : response.node.knowledge >= 0.25 ? 0.5 : 0) : null,
      confidence: response.node?.confidence ?? null,
      propagated_count: response.propagated_count,
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
    }
    if (error instanceof InvalidJsonBodyError) {
      return NextResponse.json({ error: 'Valid JSON is required' }, { status: 400 });
    }
    if (error instanceof QuizRateLimitError) {
      return NextResponse.json(
        { error: 'Too many quiz submissions. Try again shortly.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(error.retryAfterMs / 1_000)) },
        }
      );
    }
    if (error instanceof UnknownGraphNodeError) {
      return NextResponse.json({ error: 'Unknown node_id' }, { status: 400 });
    }
    console.error('Error in POST /api/quiz_result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
