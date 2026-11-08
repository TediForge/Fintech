type SessionResponse = { status?: number } | null | undefined;
type Payload = Record<string, unknown>;

function isRecord(value: unknown): value is Payload {
    return typeof value === 'object' && value !== null;
}

export function shouldTerminateSession(response: SessionResponse, data: unknown): boolean {
    if (!response) return false;
    if (response.status === 401 || response.status === 403) return true;
    if (response.status === 500) return false;

    const payload = isRecord(data) ? data : {};
    const nested = isRecord(payload.data) ? payload.data : {};
    const reasonText = [
        payload.reason, payload.message, payload.error, payload.detail,
        nested.reason, nested.message, nested.error,
    ].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase();

    const explicitSignals = [
        'session expired', 'session_expired', 'token expired', 'expired token',
        'unauthorized', 'not authenticated', 'not logged in', 'user not logged in',
        'authentication failed', 'invalid_token', 'invalid authentication token',
    ];

    return explicitSignals.some((signal) => reasonText.includes(signal));
}