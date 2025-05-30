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

interface DebugInfo {
  request?: {
    transformation: string;
    imageLength: number;
    timestamp: string;
  };
  response?: {
    status: number;
    ok: boolean;
    data: any;
    timestamp: string;
  };
  error?: {
    message: string;
    details?: any;
    timestamp: string;
  };
}

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTransformation, setSelectedTransformation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Image size must be less than 10MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setError(null);
      };
      reader.onerror = () => {
        setError('Failed to read image file');
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePinterestUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    if (url) {
      if (!url.startsWith('https://')) {
        setError('Please enter a valid HTTPS URL');
        return;
      }
      setSelectedImage(url);
      setError(null);
    } else {
      setSelectedImage(null);
    }
  };

  const handleGenerate = async () => {
    if (!selectedImage || !selectedTransformation) return;
    
    setIsLoading(true);
    setError(null);
    setDebugInfo({});
    
    try {
      const requestInfo = {
        transformation: selectedTransformation,
        imageLength: selectedImage.length,
        timestamp: new Date().toISOString(),
      };
      
      setDebugInfo(prev => ({ ...prev, request: requestInfo }));
      console.log('Starting generation request:', requestInfo);

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

      const data = await response.json();
      const responseInfo = {
        status: response.status,
        ok: response.ok,
        data: {
          ...data,
          images: data.images ? `${data.images.length} images` : 'no images',
          debug: data.debug,
        },
        timestamp: new Date().toISOString(),
      };
      
      setDebugInfo(prev => ({ ...prev, response: responseInfo }));
      console.log('API Response:', responseInfo);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to generate images');
      }
      
      // Ensure we have an array of images
      if (!Array.isArray(data.images)) {
        console.error('Invalid response format:', data);
        throw new Error(`Invalid response format from the server: ${JSON.stringify(data)}`);
      }

      // Filter out any invalid image URLs
      const validImages = data.images.filter((url: any) => {
        return typeof url === 'string' && url.length > 0 && url.startsWith('http');
      });
      
      if (validImages.length === 0) {
        console.error('No valid images in response:', data);
        throw new Error(`No valid images were generated. API Response: ${JSON.stringify(data.debug?.rawResponse)}`);
      }

      console.log('Successfully processed images:', {
        total: data.images.length,
        valid: validImages.length,
        debug: data.debug,
      });
      
      setGeneratedImages(validImages);
    } catch (error) {
      console.error('Generation error:', error);
      const errorInfo = {
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        details: error,
        timestamp: new Date().toISOString(),
      };
      setDebugInfo(prev => ({ ...prev, error: errorInfo }));
      setError(errorInfo.message);
      setGeneratedImages([]); // Clear any previous generated images on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyDebug = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Dream Machine</h1>
          <label className="flex items-center space-x-2 cursor-pointer">
            <span className="text-sm text-gray-600">Debug Mode</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={isDebugMode}
                onChange={(e) => setIsDebugMode(e.target.checked)}
              />
              <div className={`block w-14 h-8 rounded-full transition-colors ${
                isDebugMode ? 'bg-blue-600' : 'bg-gray-300'
              }`}></div>
              <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${
                isDebugMode ? 'transform translate-x-6' : ''
              }`}></div>
            </div>
          </label>
        </div>
        
        {/* Error Toast */}
        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setError(null)}
                    className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Panel */}
        {isDebugMode && (
          <div className="mb-6 bg-gray-100 rounded-lg p-4 font-mono text-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Debug Information</h2>
              <button
                onClick={handleCopyDebug}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  copyStatus === 'copied'
                    ? 'bg-green-100 text-green-800'
                    : copyStatus === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {copyStatus === 'copied' ? (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </span>
                ) : copyStatus === 'error' ? (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Failed to copy
                  </span>
                ) : (
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                    Copy
                  </span>
                )}
              </button>
            </div>
            <div className="relative">
              <pre className="whitespace-pre-wrap overflow-x-auto bg-gray-50 p-4 rounded border border-gray-200">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </div>
          </div>
        )}
        
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
                  <p className="mt-2 text-sm text-gray-500">
                    Maximum file size: 10MB
                  </p>
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
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </div>
              ) : (
                'Generate'
              )}
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
