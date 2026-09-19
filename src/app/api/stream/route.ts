import { READING_RECORDED, readingEvents } from "@/lib/events";

export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 25000;

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const events = readingEvents();

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };

      const onReading = (spaceId: string) => send("reading", spaceId);
      events.on(READING_RECORDED, onReading);

      const keepalive = setInterval(() => send("ping", ""), KEEPALIVE_MS);

      const close = () => {
        clearInterval(keepalive);
        events.off(READING_RECORDED, onReading);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", close);
      send("ready", "");
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
