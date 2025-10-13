'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { useState } from 'react';
import { CopyrightDialog } from '@/components/copyright-dialog';

const LOCAL_STORAGE_KEY_SESSION = 'magic-markup-session';

export default function ScienceFourCutPage() {
  const router = useRouter();
  const [isCopyrightOpen, setIsCopyrightOpen] = useState(false);

  const handleStart = () => {
    // Clear the previous session from local storage
    localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    router.push('/booth');
  };
  
  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans overflow-hidden">
      <div className="absolute top-8 right-8 flex flex-col gap-2">
        <a href="https://www.yes24.com/product/goods/152079426" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline"
            className="bg-transparent border-purple-400 text-purple-300 hover:bg-purple-400/20 hover:text-white animate-pulse-glow w-full"
          >
            바이브코딩 더 알아보기
          </Button>
        </a>
        <a href="https://studio--studio-6411906927-c7113.us-central1.hosted.app" target="_blank" rel="noopener noreferrer">
          <Button 
            variant="outline"
            className="bg-transparent border-gray-500 text-gray-400 hover:bg-gray-500/20 hover:text-white w-full"
          >
            개발자 정보
          </Button>
        </a>
      </div>

      <div className="w-full max-w-2xl mx-auto p-8 md:p-12 rounded-2xl bg-gray-900/50 shadow-lg text-center flex flex-col items-center gap-8">
        <div className="flex items-center justify-center gap-6">
          <Image src="/힘찬이.png" alt="힘찬이" width={100} height={100} style={{objectFit: 'contain'}} />
          <div>
            <h1 className="text-7xl font-bold">AI한컷</h1>
            <p className="text-xl text-purple-300 mt-2">AI와 함께 만드는 나만의 과학 사진</p>
          </div>
          <Image src="/과학힘찬이.png" alt="과학힘찬이" width={100} height={100} style={{objectFit: 'contain'}} />
        </div>

        <p className="text-lg text-gray-400">
          나만의 특별한 AI 사진을 만들어 보세요!
        </p>

        <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-12 py-6 text-xl" onClick={handleStart}>
            시작하기
        </Button>
      </div>

      <div className="absolute bottom-1 w-full flex flex-col items-center justify-center gap-2">
        <Image src="/교육청.png" alt="교육청 로고" width={280} height={84} style={{objectFit: 'contain'}} />
      </div>

      <p className="absolute bottom-2 left-4 text-sm text-muted-foreground">개발자 인천봉수초 교사 홍찬우</p>

      <Button
        variant="link"
        onClick={() => setIsCopyrightOpen(true)}
        className="absolute bottom-8 right-8 text-muted-foreground hover:text-white"
      >
        저작권 안내
      </Button>

      <CopyrightDialog isOpen={isCopyrightOpen} onOpenChange={setIsCopyrightOpen} />
    </div>
  );
}
