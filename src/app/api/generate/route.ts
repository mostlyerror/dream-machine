import { NextResponse } from 'next/server';
import Replicate from 'replicate';

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

async function waitForPrediction(prediction: any, maxAttempts = 30): Promise<any> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const status = await replicate.predictions.get(prediction.id);
    console.log('Prediction status:', {
      id: prediction.id,
      status: status.status,
      attempts: attempts + 1,
    });

    if (status.status === 'succeeded') {
      return status.output;
    } else if (status.status === 'failed') {
      throw new Error(`Prediction failed: ${status.error}`);
    } else if (status.status === 'canceled') {
      throw new Error('Prediction was canceled');
    }

    // Wait for 2 seconds before next attempt
    await new Promise(resolve => setTimeout(resolve, 2000));
    attempts++;
  }

  throw new Error('Prediction timed out');
}

export async function POST(request: Request) {
  try {
    const { image, transformation } = await request.json();

    // Input validation
    if (!image || !transformation) {
      console.error('Missing required fields:', { image: !!image, transformation: !!transformation });
      return NextResponse.json(
        { error: 'Image and transformation are required' },
        { status: 400 }
      );
    }

    const modelVersion = modelMap[transformation as keyof typeof modelMap];
    const prompt = promptMap[transformation as keyof typeof promptMap];

    if (!modelVersion || !prompt) {
      console.error('Invalid transformation:', transformation);
      return NextResponse.json(
        { error: 'Invalid transformation' },
        { status: 400 }
      );
    }

    console.log('Starting image generation with:', {
      transformation,
      modelVersion,
      prompt,
      imageLength: image.length,
    });

    try {
      // Start the prediction
      const prediction = await replicate.predictions.create({
        version: modelVersion,
        input: {
          image: image,
          prompt: prompt,
          num_outputs: 4,
          scheduler: "K_EULER",
          num_inference_steps: 50,
          guidance_scale: 7.5,
          negative_prompt: "blurry, low quality, distorted, disfigured",
          image_strength: 0.35,
          width: 1024,
          height: 1024,
        }
      });

      console.log('Prediction started:', {
        id: prediction.id,
        status: prediction.status,
      });

      // Wait for the prediction to complete
      const output = await waitForPrediction(prediction);

      console.log('Raw Replicate response:', {
        output,
        type: typeof output,
        isArray: Array.isArray(output),
        keys: output ? Object.keys(output) : null,
      });

      // Handle different response formats
      let imageUrls: string[] = [];
      if (Array.isArray(output)) {
        // SDXL returns an array of image URLs
        imageUrls = output.filter((url): url is string => 
          typeof url === 'string' && url.startsWith('http')
        );
      } else if (typeof output === 'object' && output !== null) {
        // Try to find image URLs in the response object
        const findUrls = (obj: any): string[] => {
          const urls: string[] = [];
          if (typeof obj === 'string' && obj.startsWith('http')) {
            urls.push(obj);
          } else if (Array.isArray(obj)) {
            obj.forEach(item => urls.push(...findUrls(item)));
          } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(value => urls.push(...findUrls(value)));
          }
          return urls;
        };
        imageUrls = findUrls(output);
      }

      console.log('Processed image URLs:', {
        total: imageUrls.length,
        urls: imageUrls,
      });

      if (imageUrls.length === 0) {
        console.error('No valid image URLs found in response:', output);
        return NextResponse.json(
          { 
            error: 'No valid images were generated',
            details: {
              rawResponse: output,
              responseType: typeof output,
              isArray: Array.isArray(output),
              keys: output ? Object.keys(output) : null,
            }
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        images: imageUrls,
        debug: {
          totalOutputs: imageUrls.length,
          rawResponse: output,
        }
      });
    } catch (replicateError) {
      console.error('Replicate API error:', {
        error: replicateError,
        message: replicateError instanceof Error ? replicateError.message : 'Unknown error',
        stack: replicateError instanceof Error ? replicateError.stack : undefined,
      });

      return NextResponse.json(
        { 
          error: 'Failed to generate images',
          details: {
            message: replicateError instanceof Error ? replicateError.message : 'Unknown error',
            type: replicateError instanceof Error ? replicateError.constructor.name : typeof replicateError,
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('General error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: {
          message: error instanceof Error ? error.message : 'Unknown error',
          type: error instanceof Error ? error.constructor.name : typeof error,
        }
      },
      { status: 500 }
    );
  }
} 