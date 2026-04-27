import { NextRequest, NextResponse } from 'next/server';
import { getCurrentActor } from '@/lib/auth';
import { submitDbQuizResult } from '@/lib/knowledge-graph-db';

export async function POST(request: NextRequest) {
  const user = await getCurrentActor();

  try {
    const body = await request.json();
    const { node_id, result } = body;

    if (!node_id || result === undefined) {
      return NextResponse.json(
        { error: 'node_id and result are required' },
        { status: 400 }
      );
    }

    if (![0, 0.5, 1].includes(result)) {
      return NextResponse.json(
        { error: 'result must be 0, 0.5, or 1' },
        { status: 400 }
      );
    }

    const response = await submitDbQuizResult(
      user.id,
      node_id,
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
    console.error('Error in POST /api/quiz_result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
