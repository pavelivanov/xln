const PREFIX = '/assistant-upstream';
const MODEL_ID = 'qwen3-coder:latest';
const SSE_HEADERS = { 'content-type': 'text/event-stream; charset=utf-8' };

type AssistantMessage = Readonly<{ role?: unknown; content?: unknown }>;

const readLatestUserMessage = async (request: Request): Promise<string> => {
  const body = await request.json() as { model?: unknown; messages?: unknown; stream?: unknown };
  if (body.model !== MODEL_ID || body.stream !== true || !Array.isArray(body.messages)) {
    throw new Error('ASSISTANT_UPSTREAM_REQUEST_INVALID');
  }
  return [...body.messages]
    .reverse()
    .find((message): message is AssistantMessage => Boolean(message) && typeof message === 'object' && message.role === 'user')
    ?.content?.toString() ?? '';
};

export const assistantUpstreamUrl = (port: number): string => `http://127.0.0.1:${port}${PREFIX}`;

export const createAssistantUpstreamFixture = () => {
  const encoder = new TextEncoder();
  let activeStreams = 0;
  let abortedStreams = 0;
  let completedStreams = 0;

  const openAbortableStream = (request: Request): ReadableStream<Uint8Array> => {
    let finished = false;
    const finish = (): void => {
      if (finished) return;
      finished = true;
      activeStreams -= 1;
      abortedStreams += 1;
    };
    return new ReadableStream<Uint8Array>({
      start(controller) {
        activeStreams += 1;
        controller.enqueue(encoder.encode('data: {"content":"1. The selected frame is acknowledged. "}\n\n'));
        request.signal.addEventListener('abort', finish, { once: true });
      },
      cancel: finish,
    });
  };

  const handle = async (request: Request, pathname: string): Promise<Response | null> => {
    if (pathname === `${PREFIX}/snapshot`) {
      return Response.json({ activeStreams, abortedStreams, completedStreams });
    }
    if (pathname === `${PREFIX}/api/models` && request.method === 'GET') {
      return Response.json({ models: [{ id: MODEL_ID, name: 'Deterministic browser fixture', available: true }] });
    }
    if (pathname !== `${PREFIX}/api/chat` || request.method !== 'POST') return null;
    const message = await readLatestUserMessage(request);
    if (message.includes('twenty detailed numbered points')) {
      return new Response(openAbortableStream(request), { headers: SSE_HEADERS });
    }
    completedStreams += 1;
    return new Response(
      'data: {"content":"selected frame acknowledged."}\n\ndata: [DONE]\n\n',
      { headers: SSE_HEADERS },
    );
  };

  return { handle };
};
