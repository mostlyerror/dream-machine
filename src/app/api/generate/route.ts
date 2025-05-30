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

    const output = await replicate.run(
      modelVersion,
      {
        input: {
          image: image,
          prompt: prompt,
          num_outputs: 4,
          scheduler: "K_EULER",
          num_inference_steps: 50,
          guidance_scale: 7.5,
        }
      }
    );

    console.log('Generation response:', {
      outputType: typeof output,
      isArray: Array.isArray(output),
      length: Array.isArray(output) ? output.length : 'N/A',
      firstItem: Array.isArray(output) && output.length > 0 ? typeof output[0] : 'N/A',
    });

    if (!Array.isArray(output)) {
      console.error('Unexpected output format:', output);
      return NextResponse.json(
        { error: 'Invalid response format from Replicate API' },
        { status: 500 }
      );
    }

    // Filter out any invalid URLs
    const validOutputs = output.filter(url => typeof url === 'string' && url.length > 0);
    
    if (validOutputs.length === 0) {
      console.error('No valid outputs generated:', output);
      return NextResponse.json(
        { error: 'No valid images were generated' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      images: validOutputs,
      debug: {
        totalOutputs: output.length,
        validOutputs: validOutputs.length,
      }
    });
  } catch (error) {
    console.error('Error generating images:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate images',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
} 