/**
 * Shared classification for low-level `fetch` transport failures.
 *
 * React Native (and the WinterCG/OkHttp fetch implementation used by Expo)
 * surfaces networking problems as a plain `TypeError` whose message embeds the
 * underlying Java/OkHttp exception, e.g.
 *
 *   "fetch failed: java.net.UnknownHostException: Unable to resolve host api.example.com"
 *   "fetch failed: java.net.SocketTimeoutException: timeout"
 *   "Network request failed"
 *
 * Those strings must never be shown to a user, so every request path funnels
 * its raw error through `classifyTransportError` and renders a friendly,
 * actionable message instead.
 */

export type TransportFailureKind =
  | 'dns'
  | 'offline'
  | 'timeout'
  | 'refused'
  | 'tls'
  | 'aborted'
  | 'unknown';

export interface TransportFailure {
  kind: TransportFailureKind;
  /** True when retrying the exact same request could plausibly succeed. */
  retryable: boolean;
}

const DNS_HINTS = [
  'unknownhostexception',
  'unable to resolve host',
  'no address associated with hostname',
  'nodename nor servname',
  'name or service not known',
  'enotfound',
  'eai_ag again',
  'dns',
];

const OFFLINE_HINTS = [
  'network request failed',
  'no internet',
  'net::err_internet_disconnected',
  'software caused connection abort',
  'econnreset',
  'epipe',
  'socket closed',
  'connection reset',
  'unable to connect to the server',
];

const TIMEOUT_HINTS = [
  'timeout',
  'timed out',
  'etimedout',
  'socket-timeout',
  'read timed out',
];

const REFUSED_HINTS = [
  'econnrefused',
  'connection refused',
  'connectexception',
];

const TLS_HINTS = [
  'sslhandshakeexception',
  'sslhandshake',
  'certificate',
  'certpathinvalid',
  'trust anchor',
  'ssl',
];

function includesAny(message: string, hints: string[]): boolean {
  return hints.some((hint) => message.includes(hint));
}

/** True when an error was produced by an `AbortController` timeout or cancel. */
export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }
  }
  return false;
}

/**
 * Maps a raw transport error onto a stable kind. Order matters: a
 * `SocketTimeoutException` also contains "timeout", and an
 * `UnknownHostException` also contains "host", so the more specific DNS and
 * TLS checks run before the generic timeout/connection checks.
 */
export function classifyTransportError(error: unknown): TransportFailure {
  if (isAbortError(error)) {
    return { kind: 'aborted', retryable: true };
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const probe = message.toLowerCase();

  if (includesAny(probe, DNS_HINTS)) {
    return { kind: 'dns', retryable: false };
  }
  if (includesAny(probe, TLS_HINTS)) {
    return { kind: 'tls', retryable: false };
  }
  if (includesAny(probe, TIMEOUT_HINTS)) {
    return { kind: 'timeout', retryable: true };
  }
  if (includesAny(probe, REFUSED_HINTS)) {
    return { kind: 'refused', retryable: false };
  }
  if (includesAny(probe, OFFLINE_HINTS)) {
    return { kind: 'offline', retryable: true };
  }

  // React Native's fetch rejects with a bare `TypeError` for every network
  // problem, so a TypeError with no recognisable detail is treated as a
  // connectivity failure rather than surfacing "TypeError: ..." to the user.
  if (error instanceof TypeError) {
    return { kind: 'offline', retryable: true };
  }

  return { kind: 'unknown', retryable: false };
}

/** Human-readable, exception-free copy for a given transport failure. */
export function describeTransportFailure(
  failure: TransportFailure,
  action: string
): string {
  switch (failure.kind) {
    case 'aborted':
      return `The request was cancelled before it finished. ${action}`;
    case 'timeout':
      return `The server took too long to respond. ${action}`;
    case 'offline':
      return `No connection to the server. Check your internet connection, then ${action}`;
    case 'refused':
      return `The server refused the connection. ${action}`;
    case 'tls':
      return `A secure connection to the server could not be established. ${action}`;
    case 'dns':
      return `The RecordioAI service address could not be resolved, so the request was never sent. The service may be temporarily unavailable. ${action}`;
    default:
      return `The request could not be completed. ${action}`;
  }
}
