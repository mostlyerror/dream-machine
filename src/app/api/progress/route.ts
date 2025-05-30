import { NextResponse } from 'next/server';
import { getProgress } from './utils';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('id');

  if (!generationId) {
    return NextResponse.json({ error: 'Generation ID is required' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial progress if available
      const initialProgress = getProgress(generationId);
      if (initialProgress) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`));
      }

      // Check for updates every second
      const interval = setInterval(() => {
        const progress = getProgress(generationId);
        if (progress) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
          
          // Close the stream if generation is complete or failed
          if (progress.status === 'complete' || progress.status === 'error') {
            clearInterval(interval);
            controller.close();
          }
        }
      }, 1000);

      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 