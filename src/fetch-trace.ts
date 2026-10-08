export const fetchTrace = async (traceId: string, apiUrl: string): Promise<unknown> => {
  const url = new URL(`/traces/${encodeURIComponent(traceId)}`, apiUrl);
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Trace API is not reachable at ${apiUrl}. ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Trace API returned ${response.status} for ${traceId}`);
  }
  return response.json();
};
