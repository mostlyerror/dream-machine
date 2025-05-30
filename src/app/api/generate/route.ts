import { NextResponse } from 'next/server';
import Replicate from 'replicate';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Map of transformation IDs to Replicate model versions
const modelMap = {
  sargent: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  surrealist: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  'color-palette': "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  background: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  composition: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
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

    if (!image || !transformation) {
      return NextResponse.json(
        { error: 'Image and transformation are required' },
        { status: 400 }
      );
    }

    const modelVersion = modelMap[transformation as keyof typeof modelMap];
    const prompt = promptMap[transformation as keyof typeof promptMap];

    if (!modelVersion || !prompt) {
      return NextResponse.json(
        { error: 'Invalid transformation' },
        { status: 400 }
      );
    }

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

    return NextResponse.json({ images: output });
  } catch (error) {
    console.error('Error generating images:', error);
    return NextResponse.json(
      { error: 'Failed to generate images' },
      { status: 500 }
    );
  }
} 