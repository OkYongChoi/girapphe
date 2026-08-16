export type AssessmentValue = 0 | 0.5 | 1;

export type AssessmentSubmission<Node> = {
  success: boolean;
  node: Node | null;
  propagated_count: number;
  error?: 'rate_limited' | 'unknown_node' | 'save_failed';
  retry_after_ms?: number;
};

type SubmitAssessmentWithCooldownRetryOptions<Node> = {
  nodeId: string;
  result: AssessmentValue;
  submit: (nodeId: string, result: AssessmentValue) => Promise<AssessmentSubmission<Node>>;
  sleep?: (milliseconds: number) => Promise<void>;
  onRateLimited?: (retryAfterMs: number) => void;
};

const DEFAULT_RETRY_AFTER_MS = 2_000;
const MAX_RETRY_AFTER_MS = 5_000;

export async function submitAssessmentWithCooldownRetry<Node>({
  nodeId,
  result,
  submit,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  onRateLimited,
}: SubmitAssessmentWithCooldownRetryOptions<Node>): Promise<AssessmentSubmission<Node>> {
  let response = await submit(nodeId, result);
  if (response.success || response.error !== 'rate_limited') return response;

  const retryAfterMs = Math.min(
    MAX_RETRY_AFTER_MS,
    Math.max(0, response.retry_after_ms ?? DEFAULT_RETRY_AFTER_MS)
  );
  onRateLimited?.(retryAfterMs);
  await sleep(retryAfterMs);

  response = await submit(nodeId, result);
  return response;
}
