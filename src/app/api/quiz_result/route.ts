import { NextRequest, NextResponse } from 'next/server';
import { processQuizResult, getGraphDataForUser, runGlobalDiffusion } from '@/lib/graph-store';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

    const { directUpdate, propagatedUpdates } = processQuizResult(
      user.id,
      node_id,
      result as 0 | 0.5 | 1
    );
    runGlobalDiffusion(user.id, 0.3);

    const graphData = getGraphDataForUser(user.id);
    const updatedNode = graphData.nodes.find((n) => n.id === node_id);

    return NextResponse.json({
      success: true,
      node: updatedNode ?? null,
      knowledge_state: directUpdate.knowledge_state,
      confidence: directUpdate.confidence,
      propagated_count: propagatedUpdates.size,
      first_known_at: directUpdate.first_known_at,
    });
  } catch (error) {
    console.error('Error in POST /api/quiz_result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
