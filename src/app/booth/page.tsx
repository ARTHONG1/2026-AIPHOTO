'use client';

import { useState, useRef, useEffect, ChangeEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Camera, Check, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMagicMarkup } from '@/hooks/use-magic-markup';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function BoothPageClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { startNewSession } = useMagicMarkup();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const aspectRatio = 2 / 3;

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this feature.',
        });
      }
    };
    getCameraPermission();
  }, [toast]);

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        
        let sourceX, sourceY, sourceWidth, sourceHeight;

        if (videoWidth / videoHeight > aspectRatio) {
          // Video is wider than the target ratio, crop the sides
          sourceHeight = videoHeight;
          sourceWidth = sourceHeight * aspectRatio;
          sourceX = (videoWidth - sourceWidth) / 2;
          sourceY = 0;
        } else {
          // Video is taller than the target ratio, crop the top and bottom
          sourceWidth = videoWidth;
          sourceHeight = sourceWidth / aspectRatio;
          sourceX = 0;
          sourceY = (videoHeight - sourceHeight) / 2;
        }

        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        
        context.drawImage(
            video,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            sourceWidth,
            sourceHeight
        );
        const data = canvas.toDataURL('image/png');
        setPhotoData(data);
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const imageDataUrl = event.target?.result as string;
        if (imageDataUrl) {
            startNewSession(imageDataUrl);
            router.push('/editor?isGuided=true');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const resetPhoto = () => {
    setPhotoData(null);
  };

  const confirmPhoto = async () => {
    if (!photoData) return;
    
    startNewSession(photoData);
    router.push('/editor?isGuided=true');
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold mb-2">포토부스</h1>
        <p className="text-muted-foreground mb-6">카메라를 보고 멋진 포즈를 취하거나 이미지를 업로드해주세요!</p>

        <div className="relative mx-auto w-full max-w-sm aspect-[2/3] overflow-hidden rounded-lg shadow-lg" style={{ backgroundColor: '#000000' }}>
            <div className="absolute inset-0 p-4 pb-12 flex items-center justify-center">
                {photoData ? (
                <img src={photoData} alt="User capture" className="w-full h-full object-contain" />
                ) : (
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
                )}
            </div>

            {!hasCameraPermission && !photoData && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
                <Alert variant="destructive">
                    <AlertTitle>카메라 접근 필요</AlertTitle>
                    <AlertDescription>
                    이 기능을 사용하려면 브라우저 설정에서 카메라 접근을 허용해주세요.
                    </AlertDescription>
                </Alert>
                </div>
            )}
        </div>

        <canvas ref={canvasRef} className="hidden"></canvas>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden"
            accept="image/*"
        />

        <div className="mt-6 flex justify-center gap-4">
          {photoData ? (
            <>
              <Button size="lg" variant="outline" onClick={resetPhoto}>
                <RefreshCw className="mr-2" /> 다시 찍기
              </Button>
              <Button size="lg" onClick={confirmPhoto}>
                <Check className="mr-2" />
                사진 사용
              </Button>
            </>
          ) : (
            <>
                <Button size="lg" onClick={takePhoto} disabled={!hasCameraPermission}>
                    <Camera className="mr-2" /> 사진 찍기
                </Button>
                <Button size="lg" variant="outline" onClick={handleUploadClick}>
                    <Upload className="mr-2" /> 이미지 업로드
                </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function BoothPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <BoothPageClient />
        </Suspense>
    )
}
