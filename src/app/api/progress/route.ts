import { NextResponse } from 'next/server';

// Store progress updates for each generation
const progressUpdates = new Map<string, {
  status: string;
  progress: number;
  message: string;
}>();

// Function to update progress for a specific generation
export function updateProgress(generationId: string, status: string, progress: number, message: string) {
  progressUpdates.set(generationId, { status, progress, message });
}

// Function to get progress for a specific generation
export function getProgress(generationId: string) {
  return progressUpdates.get(generationId);
}

// Function to clear progress for a specific generation
export function clearProgress(generationId: string) {
  progressUpdates.delete(generationId);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const generationId = searchParams.get('id');

  if (!generationId) {
    return new NextResponse('Missing generation ID', { status: 400 });
  }

  // Set up SSE headers
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial progress if available
      const initialProgress = getProgress(generationId);
      if (initialProgress) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialProgress)}\n\n`));
      }

      // Set up interval to check for progress updates
      const interval = setInterval(() => {
        const progress = getProgress(generationId);
        if (progress) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(progress)}\n\n`));
          
          // If generation is complete, close the stream
          if (progress.status === 'complete') {
            clearInterval(interval);
            controller.close();
            clearProgress(generationId);
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

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
} 