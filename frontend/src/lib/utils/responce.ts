type TextResponse = Pick<Response, 'text'>;

export async function parseJsonResponse<T = unknown>(
  response: TextResponse | null | undefined,
  fallback: T | null = null,
): Promise<T | null> {
  if (!response || typeof response.text !== 'function') {
    return fallback;
  }

  try {
    const text = await response.text();
    if (!text || !text.trim()) {
      return fallback;
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('<')) {
      return fallback;
    }

    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}
