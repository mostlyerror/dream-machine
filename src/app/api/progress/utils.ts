interface ProgressUpdate {
  status: 'starting' | 'generating' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
}

// Store progress updates for each generation
const progressMap = new Map<string, ProgressUpdate>();

export function updateProgress(generationId: string, update: ProgressUpdate) {
  progressMap.set(generationId, update);
}

export function getProgress(generationId: string): ProgressUpdate | undefined {
  return progressMap.get(generationId);
}

export function clearProgress(generationId: string) {
  progressMap.delete(generationId);
} 