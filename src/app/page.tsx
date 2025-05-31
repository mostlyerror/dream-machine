'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const transformations = [
  { id: 'sargent', label: 'Sargent Style 🎨' },
  { id: 'surrealist', label: 'Make it surrealist 🌈' },
  { id: 'color-palette', label: 'Vary the color palette 🎨' },
  { id: 'background', label: 'Change the background 🌅' },
  { id: 'composition', label: 'Show alternate compositions 🖼️' },
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
    data: {
      images?: string[];
      generationId?: string;
      error?: string;
    };
    timestamp: string;
  };
  error?: {
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedTransformation, setSelectedTransformation] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [generationStatus, setGenerationStatus] = useState<{
    status: 'idle' | 'starting' | 'generating' | 'processing';
    progress: number;
    message: string;
  }>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

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

  // Function to connect to SSE
  const connectToSSE = (generationId: string) => {
    // Close existing connection if any
    if (eventSource) {
      eventSource.close();
    }

    // Create new EventSource connection
    const source = new EventSource(`/api/progress?id=${generationId}`);
    setEventSource(source);

    // Handle incoming messages
    source.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data);
        setGenerationStatus({
          status: progress.status,
          progress: progress.progress,
          message: progress.message,
        });
      } catch (error) {
        console.error('Error parsing progress update:', error);
      }
    };

    // Handle errors
    source.onerror = (error) => {
      console.error('SSE Error:', error);
      source.close();
      setEventSource(null);
    };

    return source;
  };

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [eventSource]);

  const handleGenerate = async () => {
    if (!selectedImage || !selectedTransformation) {
      setError('Please select an image and transformation');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImages([]);
    setDebugInfo(null);
    setGenerationStatus({
      status: 'starting',
      progress: 0,
      message: 'Starting image generation...',
    });

    try {
      console.log('Starting generation request:', {
        transformation: selectedTransformation,
        imageLength: selectedImage.length,
        timestamp: new Date().toISOString(),
      });

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

      console.log('API Response:', {
        status: response.status,
        ok: response.ok,
        timestamp: new Date().toISOString(),
      });

      const data = await response.json();
      console.log('Response data:', {
        images: data.images?.length || 0,
        timestamp: new Date().toISOString(),
      });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate images');
      }

      if (!data.images || data.images.length === 0) {
        throw new Error('No valid images were generated');
      }

      // Connect to SSE for progress updates
      if (data.generationId) {
        connectToSSE(data.generationId);
      }

      setGeneratedImages(data.images);
      setDebugInfo({
        request: {
          transformation: selectedTransformation,
          imageLength: selectedImage.length,
          timestamp: new Date().toISOString(),
        },
        response: {
          status: response.status,
          ok: response.ok,
          data: data,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Generation error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred');
      setDebugInfo(prev => prev ? {
        ...prev,
        error: {
          message: error instanceof Error ? error.message : 'An error occurred',
          details: error instanceof Error ? error : undefined,
          timestamp: new Date().toISOString(),
        }
      } : null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyDebug = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white font-plus-jakarta">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl transform hover:rotate-12 transition-transform duration-300">☁️</span>
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 hover:from-pink-600 hover:to-purple-400 transition-all duration-500 tracking-tight">
                Dream Machine
              </h1>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 animate-pulse font-medium">
              AI Magic ✨
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Remove the debug toggle switch */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column - Control Panel */}
          <div className="col-span-4 space-y-6">
            {/* Upload Section */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-colors duration-300 group">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="group-hover:text-purple-400 transition-colors">Upload Image</span>
                <span className="text-sm text-purple-400/50">(drag & drop)</span>
              </h2>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className={`block cursor-pointer transition-all duration-300 ${
                    selectedImage ? 'hover:scale-[1.02]' : ''
                  }`}
                >
                  <div className={`relative aspect-square rounded-lg overflow-hidden border-2 border-dashed ${
                    selectedImage 
                      ? 'border-gray-600 hover:border-purple-500' 
                      : 'border-gray-600 hover:border-purple-500'
                  } transition-all duration-300`}>
                    {selectedImage ? (
                      <>
                        <Image
                          src={selectedImage}
                          alt="Selected image"
                          fill
                          className="object-contain"
                        />
                        <div className="absolute top-4 right-4">
                          <span className="px-3 py-1 bg-gray-900/80 backdrop-blur-sm text-sm text-gray-300 rounded-full border border-gray-700">
                            Preview
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            Click to change image
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-purple-400 hover:text-purple-300 transition-colors">
                        <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-center">
                          Click to upload or drag and drop
                          <br />
                          <span className="text-sm text-gray-400 mt-2 block">
                            Maximum file size: 10MB
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Transformation Selection */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 group">
              <h2 className="text-xl font-semibold text-white mb-4 group-hover:text-purple-400 transition-colors">Select Transformation</h2>
              <select
                value={selectedTransformation}
                onChange={(e) => setSelectedTransformation(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-white transition-all duration-300 hover:border-purple-500/50"
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
              className={`w-full py-3 px-6 rounded-lg text-white font-semibold transition-all duration-300 ${
                !selectedImage || !selectedTransformation || isLoading
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20'
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
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate
                </span>
              )}
            </button>
          </div>

          {/* Right Column - Generated Images */}
          <div className="col-span-8 space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all duration-300">
                <div className="flex items-center gap-4 mb-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-400">
                      {generationStatus.message}
                    </h3>
                    <p className="text-sm text-gray-400">
                      This may take up to a minute...
                    </p>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 animate-pulse"
                    style={{
                      width: `${generationStatus.progress}%`,
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 animate-shake">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-200">{error}</p>
                </div>
              </div>
            )}

            {/* Generated Images Grid */}
            {generatedImages.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all duration-300 group">
                <h2 className="text-xl font-semibold text-white mb-4 group-hover:text-purple-400 transition-colors">Generated Variants</h2>
                <div className="grid grid-cols-2 gap-4">
                  {generatedImages.map((image, index) => (
                    <div 
                      key={index} 
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-700 group-hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20"
                    >
                      <Image
                        src={image}
                        alt={`Generated variant ${index + 1}`}
                        fill
                        className="object-contain transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Panel */}
            <div 
              onClick={() => setIsDebugMode(!isDebugMode)}
              className={`fixed bottom-0 right-0 w-96 h-[calc(100vh-4rem)] bg-gray-800/95 backdrop-blur-sm border-l border-t border-gray-700 shadow-2xl transform transition-all duration-300 ease-in-out cursor-pointer rounded-tl-xl ${
                isDebugMode ? 'translate-x-0' : 'translate-x-[calc(100%-2rem)]'
              }`}
            >
              {/* Debug Panel Handle */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-16 bg-gray-800/95 backdrop-blur-sm border border-gray-700 rounded-l-lg flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                <svg className="w-5 h-5 transform transition-transform duration-300" style={{ transform: `rotate(${isDebugMode ? 180 : 0}deg)` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {/* Debug Panel Content */}
              <div className="h-full ml-8" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-3 border-b border-gray-700">
                  <h2 className="text-base font-semibold text-white">Debug Information</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyDebug}
                      className={`px-2 py-1 rounded-md text-xs font-medium transition-all duration-300 ${
                        copyStatus === 'copied'
                          ? 'bg-green-900/50 text-green-400'
                          : copyStatus === 'error'
                          ? 'bg-red-900/50 text-red-400'
                          : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:scale-105'
                      }`}
                    >
                      {copyStatus === 'copied' ? (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </span>
                      ) : copyStatus === 'error' ? (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Failed to copy
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                          </svg>
                          Copy
                        </span>
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-3 overflow-y-auto h-[calc(100%-3rem)]">
                  <pre className="whitespace-pre-wrap overflow-x-auto bg-gray-900/50 p-3 rounded-lg border border-gray-700 text-gray-300 text-xs">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attribution */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-gray-500/50 hover:text-gray-400 transition-colors duration-300">
        <div className="flex items-center gap-4 text-sm">
          <span>made with <span className="text-pink-500">♥</span> by</span>
          <div className="flex items-center gap-3">
            <a 
              href="https://instagram.com/beeteepee_" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-pink-400 transition-colors"
            >
              @beeteepee_
            </a>
            <span className="text-gray-600">•</span>
            <a 
              href="https://github.com/mostlyerror" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-purple-400 transition-colors"
            >
              github
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
