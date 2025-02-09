import React, { useState, useRef } from 'react';
import { Camera, Upload, Download, RefreshCw, ImageIcon, Settings, SunMedium, Contrast, Focus, Sparkles } from 'lucide-react';

type Resolution = {
  name: string;
  dpi: number;
  description: string;
};

type EnhancementPreset = {
  name: string;
  icon: React.ReactNode;
  settings: {
    brightness: number;
    contrast: number;
    sharpness: number;
    deblur: number;
    denoise: number;
  };
  description: string;
};

const RESOLUTIONS: Resolution[] = [
  { name: 'Standard Web', dpi: 72, description: 'Best for web and digital display' },
  { name: 'Medium Quality', dpi: 150, description: 'Good for larger screens and basic prints' },
  { name: 'Print Quality', dpi: 300, description: 'Ideal for standard printing' },
  { name: 'High-Res Print', dpi: 600, description: 'Perfect for professional printing' }
];

const ENHANCEMENT_PRESETS: EnhancementPreset[] = [
  {
    name: 'Balanced',
    icon: <Settings size={18} className="text-blue-500" />,
    settings: { 
      brightness: 1.0, 
      contrast: 1.0, 
      sharpness: 1.1,
      deblur: 0.5,
      denoise: 0.3
    },
    description: 'Subtle enhancement for natural results'
  },
  {
    name: 'Clarity',
    icon: <Focus size={18} className="text-emerald-500" />,
    settings: { 
      brightness: 1.05, 
      contrast: 1.1, 
      sharpness: 1.4,
      deblur: 0.8,
      denoise: 0.4
    },
    description: 'Optimized for fixing blurry images'
  },
  {
    name: 'HDR',
    icon: <SunMedium size={18} className="text-orange-500" />,
    settings: { 
      brightness: 1.15, 
      contrast: 1.3, 
      sharpness: 1.2,
      deblur: 0.6,
      denoise: 0.5
    },
    description: 'High dynamic range look'
  },
  {
    name: 'AI Enhance',
    icon: <Sparkles size={18} className="text-purple-500" />,
    settings: { 
      brightness: 1.1, 
      contrast: 1.2, 
      sharpness: 1.5,
      deblur: 1.0,
      denoise: 0.7
    },
    description: 'Maximum detail recovery'
  }
];

function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[1]);
  const [selectedPreset, setSelectedPreset] = useState<EnhancementPreset>(ENHANCEMENT_PRESETS[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 3840 }, // 4K
          height: { ideal: 2160 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure you have granted camera permissions.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 1.0);
        setImage(imageData);
        setShowCamera(false);
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyDeblur = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    strength: number
  ) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const tempData = new Uint8ClampedArray(data);
    
    // Advanced unsharp masking
    const radius = Math.ceil(strength * 3);
    const amount = strength * 1.5;
    const threshold = 10;
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * width + x) * 4 + c;
          
          // Calculate local average (blur)
          let sum = 0;
          let count = 0;
          
          for (let ky = -radius; ky <= radius; ky++) {
            for (let kx = -radius; kx <= radius; kx++) {
              const currentIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += tempData[currentIdx];
              count++;
            }
          }
          
          const avg = sum / count;
          const diff = tempData[idx] - avg;
          
          // Apply unsharp mask only if difference exceeds threshold
          if (Math.abs(diff) > threshold) {
            data[idx] = Math.min(255, Math.max(0, 
              tempData[idx] + diff * amount
            ));
          }
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const applyDenoise = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    strength: number
  ) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const tempData = new Uint8ClampedArray(data);
    
    const radius = Math.ceil(strength * 2);
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        for (let c = 0; c < 3; c++) {
          const idx = (y * width + x) * 4 + c;
          
          // Collect neighboring pixels
          const neighbors = [];
          for (let ky = -radius; ky <= radius; ky++) {
            for (let kx = -radius; kx <= radius; kx++) {
              const currentIdx = ((y + ky) * width + (x + kx)) * 4 + c;
              neighbors.push(tempData[currentIdx]);
            }
          }
          
          // Sort neighbors and take median
          neighbors.sort((a, b) => a - b);
          const median = neighbors[Math.floor(neighbors.length / 2)];
          
          // Mix original and median based on strength
          data[idx] = tempData[idx] * (1 - strength) + median * strength;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);
  };

  const applyImageEnhancements = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    settings: EnhancementPreset['settings']
  ) => {
    // Apply denoising first
    if (settings.denoise > 0) {
      applyDenoise(ctx, width, height, settings.denoise);
    }
    
    // Apply deblur
    if (settings.deblur > 0) {
      applyDeblur(ctx, width, height, settings.deblur);
    }
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply brightness and contrast
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      for (let j = 0; j < 3; j++) {
        data[i + j] = Math.min(255, data[i + j] * settings.brightness);
      }

      // Apply contrast
      for (let j = 0; j < 3; j++) {
        const channel = data[i + j];
        data[i + j] = Math.min(255, 
          ((channel / 255 - 0.5) * settings.contrast + 0.5) * 255
        );
      }
    }

    // Apply sharpening if sharpness > 1
    if (settings.sharpness > 1) {
      const sharpenStrength = (settings.sharpness - 1) * 0.8;
      const kernel = [
        [-1, -1, -1],
        [-1, 9 + sharpenStrength, -1],
        [-1, -1, -1]
      ];
      
      const tempImageData = new ImageData(
        new Uint8ClampedArray(data), 
        width, 
        height
      );
      
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                sum += tempImageData.data[idx] * kernel[ky + 1][kx + 1];
              }
            }
            const idx = (y * width + x) * 4 + c;
            data[idx] = Math.min(255, Math.max(0, sum));
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const enhanceImage = async () => {
    if (!image) return;
    
    setIsProcessing(true);
    
    const img = new Image();
    img.src = image;
    
    await new Promise((resolve) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Calculate new dimensions based on DPI
        const scaleFactor = selectedResolution.dpi / 72; // 72 is base web DPI
        canvas.width = img.width * scaleFactor;
        canvas.height = img.height * scaleFactor;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Apply high-quality image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          // Draw image with bicubic-like scaling
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Apply enhancements based on selected preset
          applyImageEnhancements(
            ctx, 
            canvas.width, 
            canvas.height, 
            selectedPreset.settings
          );
          
          const enhancedImage = canvas.toDataURL('image/jpeg', 0.95);
          setImage(enhancedImage);
        }
        resolve(null);
      };
    });
    
    setIsProcessing(false);
  };

  const downloadImage = () => {
    if (!image) return;
    
    const link = document.createElement('a');
    link.href = image;
    link.download = `enhanced-image-${selectedResolution.dpi}dpi-${selectedPreset.name.toLowerCase()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-4 sm:p-6 md:p-8">
      <main className="max-w-3xl mx-auto">
        <div className="container-card p-6 sm:p-8">
          <header className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Image Enhancement
            </h1>
            <p className="text-gray-600">
              Enhance your photos with our advanced image processing
            </p>
          </header>

          {showCamera ? (
            <section 
              aria-label="Camera capture"
              className="space-y-4"
            >
              <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full aspect-video object-cover"
                  aria-label="Camera preview"
                />
              </div>
              <button
                onClick={capturePhoto}
                className="btn-primary w-full"
                aria-label="Take photo"
              >
                <Camera size={20} aria-hidden="true" />
                Capture Photo
              </button>
            </section>
          ) : (
            <div className="space-y-8">
              {!image ? (
                <section 
                  aria-label="Image upload options"
                  className="space-y-6"
                >
                  <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-center">
                    <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" aria-hidden="true" />
                    <h2 className="text-lg font-medium text-gray-900 mb-2">
                      Start with an image
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Take a new photo or upload an existing one
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={startCamera}
                        className="btn-primary"
                        aria-label="Open camera"
                      >
                        <Camera size={20} aria-hidden="true" />
                        Take Photo
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="btn-primary"
                        aria-label="Upload image"
                      >
                        <Upload size={20} aria-hidden="true" />
                        Upload Image
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept="image/*"
                        className="hidden"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </section>
              ) : (
                <section 
                  aria-label="Image preview and controls"
                  className="space-y-6"
                >
                  <div className="relative bg-gray-100 rounded-xl overflow-hidden">
                    <img
                      src={image}
                      alt="Preview of the selected or captured image"
                      className="w-full object-contain"
                    />
                  </div>
                  
                  <div className="space-y-6">
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Settings size={18} className="text-gray-400" />
                        <span className="font-medium">Enhancement Preset</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {ENHANCEMENT_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => setSelectedPreset(preset)}
                            className={`p-3 rounded-lg text-left transition-colors ${
                              selectedPreset.name === preset.name
                                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {preset.icon}
                              <span className="font-medium">{preset.name}</span>
                            </div>
                            <div className="text-sm text-gray-500">{preset.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Settings size={18} className="text-gray-400" />
                        <span className="font-medium">Resolution Settings</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {RESOLUTIONS.map((res) => (
                          <button
                            key={res.dpi}
                            onClick={() => setSelectedResolution(res)}
                            className={`p-3 rounded-lg text-left transition-colors ${
                              selectedResolution.dpi === res.dpi
                                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500'
                                : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-medium">{res.name}</div>
                            <div className="text-sm text-gray-500">{res.dpi} DPI</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={enhanceImage}
                      disabled={isProcessing}
                      className="btn-success"
                      aria-label={isProcessing ? "Processing image" : "Enhance image"}
                    >
                      <RefreshCw 
                        size={20} 
                        className={isProcessing ? 'animate-spin' : ''} 
                        aria-hidden="true"
                      />
                      {isProcessing ? 'Processing...' : 'Enhance Image'}
                    </button>
                    
                    <button
                      onClick={downloadImage}
                      className="btn-primary"
                      aria-label="Download enhanced image"
                    >
                      <Download size={20} aria-hidden="true" />
                      Download
                    </button>
                  </div>

                  <button
                    onClick={() => setImage(null)}
                    className="w-full text-gray-600 hover:text-gray-900 text-sm font-medium"
                    aria-label="Start over with a new image"
                  >
                    Start Over
                  </button>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;