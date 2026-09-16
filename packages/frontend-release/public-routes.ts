export type GatewayRedirectDecision = Readonly<{
  kind: 'redirect';
  status: 307 | 308;
  location: `/${string}`;
}>;

export type GatewayResponseDecision = Readonly<{
  kind: 'response';
  status: 200 | 400;
  body: string;
  headers: Readonly<Record<string, string>>;
}>;

export const resolvePublicRoute = (url: URL): GatewayRedirectDecision | GatewayResponseDecision | null => {
  if (url.pathname === '/admin') return { kind: 'redirect', status: 308, location: '/health' };
  if (url.pathname === '/radapter') {
    if (url.search === '') return { kind: 'redirect', status: 307, location: '/app' };
    return {
      kind: 'response',
      status: 400,
      body: 'REMOTE_RUNTIME_QUERY_BOOTSTRAP_FORBIDDEN',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    };
  }
  if (url.pathname === '/resetdb') {
    return {
      kind: 'response',
      status: 200,
      body: 'Resetting local data',
      headers: {
        'cache-control': 'no-store, max-age=0',
        'clear-site-data': '"*"',
        refresh: '0;url=/app',
        'content-type': 'text/plain; charset=utf-8',
      },
    };
  }

  return null;
};
