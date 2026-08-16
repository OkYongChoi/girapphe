function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Authorization, Cookie',
    },
  });
}

export function authenticationRequiredEntitlementResponse(): Response {
  return json({ error: 'authentication_required' }, 401);
}

export async function readEntitlementResponse(
  readEntitlement: () => Promise<boolean>,
): Promise<Response> {
  try {
    return json({ isAdFree: await readEntitlement() });
  } catch (error) {
    console.error('Unable to read billing entitlement:', error);
    return json({ error: 'entitlement_unavailable' }, 503);
  }
}
