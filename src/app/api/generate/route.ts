import { NextResponse } from 'next/server';
import Replicate from 'replicate';
import { updateProgress, clearProgress } from '../progress/route';
import { v4 as uuidv4 } from 'uuid';

interface PredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
}

interface GenerateRequest {
  image: string;
  transformation: string;
}

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Map of transformation IDs to Replicate model versions
const modelMap = {
  sargent: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as const,
  surrealist: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as const,
  'color-palette': "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as const,
  background: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as const,
  composition: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b" as const,
};

// Map of transformation IDs to their corresponding prompts
const promptMap = {
  sargent: "Transform this image into the style of John Singer Sargent, with his characteristic loose brushwork, dramatic lighting, and elegant portraiture style",
  surrealist: "Transform this image into a surrealist style, with dreamlike elements, unexpected juxtapositions, and a touch of Salvador Dali's influence",
  'color-palette': "Create variations of this image with different color palettes while maintaining the original composition and subject matter",
  background: "Keep the main subject but change the background to create different moods and settings",
  composition: "Create alternative compositions of this image, exploring different angles, framing, and arrangements of elements",
};

async function waitForPrediction(predictionId: string, generationId: string): Promise<string[]> {
  let attempts = 0;
  const maxAttempts = 30; // 1 minute maximum wait time

  while (attempts < maxAttempts) {
    const prediction = await replicate.predictions.get(predictionId) as PredictionResponse;
    
    const progress = Math.min(100, Math.max(0, (attempts / maxAttempts) * 100));
    console.log(`Prediction status: ${prediction.status}, Progress: ${progress}%`);
    
    if (prediction.status === 'processing') {
      updateProgress(generationId, {
        status: 'processing',
        progress,
        message: 'Processing image...',
      });
    } else if (prediction.status === 'succeeded' && prediction.output) {
      updateProgress(generationId, {
        status: 'complete',
        progress: 100,
        message: 'Generation complete!',
      });
      return prediction.output;
    } else if (prediction.status === 'failed' || prediction.status === 'canceled') {
      updateProgress(generationId, {
        status: 'error',
        progress,
        message: prediction.error || 'Generation failed',
      });
      throw new Error(prediction.error || 'Prediction failed');
    } else {
      updateProgress(generationId, {
        status: 'generating',
        progress,
        message: 'Generating images...',
      });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  updateProgress(generationId, {
    status: 'error',
    progress: 100,
    message: 'Generation timed out',
  });
  throw new Error('Prediction timed out');
}

export async function POST(request: Request) {
  try {
    const { image, transformation } = await request.json() as GenerateRequest;

    if (!image || !transformation) {
      return NextResponse.json(
        { error: 'Image and transformation are required' },
        { status: 400 }
      );
    }

    const generationId = uuidv4();
    console.log('Starting generation:', {
      transformation,
      imageLength: image.length,
      generationId,
      timestamp: new Date().toISOString(),
    });

    updateProgress(generationId, {
      status: 'starting',
      progress: 0,
      message: 'Starting image generation...',
    });

    const prediction = await replicate.predictions.create({
      version: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        image,
        prompt: transformation,
        image_strength: 0.35,
        negative_prompt: "blurry, low quality, distorted, deformed",
        width: 1024,
        height: 1024,
        num_outputs: 4,
        scheduler: "K_EULER",
        num_inference_steps: 50,
        guidance_scale: 7.5,
      },
    }) as PredictionResponse;

    console.log('Prediction started:', {
      id: prediction.id,
      status: prediction.status,
      timestamp: new Date().toISOString(),
    });

    updateProgress(generationId, {
      status: 'generating',
      progress: 10,
      message: 'Generating images...',
    });

    const output = await waitForPrediction(prediction.id, generationId);

    console.log('Raw response:', {
      type: typeof output,
      isArray: Array.isArray(output),
      keys: output ? Object.keys(output) : null,
      timestamp: new Date().toISOString(),
    });

    if (!output || !Array.isArray(output)) {
      throw new Error('Invalid response format from Replicate API');
    }

    const images = output.filter(url => url && url.startsWith('http'));

    if (images.length === 0) {
      throw new Error('No valid images were generated');
    }

    // Clear progress after a delay to ensure the client receives the final update
    setTimeout(() => clearProgress(generationId), 5000);

    return NextResponse.json({ images, generationId });
  } catch (error) {
    console.error('Generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 