'use client';

import { useState } from 'react';
import Image from 'next/image';

const transformations = [
  { id: 'sargent', label: 'Sargent Style' },
  { id: 'surrealist', label: 'Make it surrealist' },
  { id: 'color-palette', label: 'Vary the color palette' },
  { id: 'background', label: 'Change the background' },
  { id: 'composition', label: 'Show alternate compositions' },
];

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTransformation, setSelectedTransformation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePinterestUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(e.target.value);
  };

  const handleGenerate = async () => {
    if (!selectedImage || !selectedTransformation) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: selectedImage,
          transformation: selectedTransformation,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate images');
      }

      const data = await response.json();
      setGeneratedImages(data.images);
    } catch (error) {
      console.error('Error:', error);
      // TODO: Add proper error handling UI
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Dream Machine</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="space-y-6">
            {/* Image Upload Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Upload Image</h2>
              <div className="flex flex-col space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="cursor-pointer text-blue-600 hover:text-blue-800"
                  >
                    Click to upload or drag and drop
                  </label>
                </div>
                
                <div className="text-center text-gray-500">or</div>
                
                <input
                  type="text"
                  placeholder="Paste Pinterest image URL"
                  onChange={handlePinterestUrl}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Preview Section */}
            {selectedImage && (
              <div className="relative w-full h-64 rounded-lg overflow-hidden">
                <Image
                  src={selectedImage}
                  alt="Selected image"
                  fill
                  className="object-contain"
                />
              </div>
            )}

            {/* Transformation Selection */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Select Transformation</h2>
              <select
                value={selectedTransformation}
                onChange={(e) => setSelectedTransformation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a transformation...</option>
                {transformations.map((transformation) => (
                  <option key={transformation.id} value={transformation.id}>
                    {transformation.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedImage || !selectedTransformation || isLoading}
              className={`w-full py-3 px-6 rounded-lg text-white font-semibold ${
                !selectedImage || !selectedTransformation || isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>

        {/* Generated Images Grid */}
        {generatedImages.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Generated Variants</h2>
            <div className="grid grid-cols-2 gap-4">
              {generatedImages.map((image, index) => (
                <div key={index} className="relative w-full h-64 rounded-lg overflow-hidden">
                  <Image
                    src={image}
                    alt={`Generated variant ${index + 1}`}
                    fill
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
