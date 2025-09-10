
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Beaker, FlaskConical, TestTube, Atom } from 'lucide-react';
import Image from 'next/image';

const LOCAL_STORAGE_KEY_SESSION = 'magic-markup-session';

export default function ScienceFourCutPage() {
  const router = useRouter();

  const handleStart = () => {
    // Clear the previous session from local storage
    localStorage.removeItem(LOCAL_STORAGE_KEY_SESSION);
    router.push('/booth');
  };
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
      <div className="w-full max-w-2xl mx-auto p-8 md:p-12 border-2 border-dashed border-purple-400/50 rounded-2xl bg-gray-900/50 shadow-lg text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Image src="/icon.png" alt="과학네컷 로고" width={64} height={64} className="rounded-xl" />
          <div>
            <h1 className="text-4xl font-bold">과학네컷</h1>
            <p className="text-purple-300">AI와 함께 만드는 나만의 과학 사진</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 my-8">
          <div className="p-4 bg-gray-800/50 rounded-lg flex items-center justify-center aspect-square">
            <Beaker className="w-10 h-10 text-purple-400" />
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg flex items-center justify-center aspect-square">
            <FlaskConical className="w-10 h-10 text-pink-400" />
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg flex items-center justify-center aspect-square">
            <TestTube className="w-10 h-10 text-purple-400" />
          </div>
          <div className="p-4 bg-gray-800/50 rounded-lg flex items-center justify-center aspect-square">
            <Atom className="w-10 h-10 text-pink-400" />
          </div>
        </div>

        <p className="mb-8 text-gray-400">
          AI의 놀라운 능력으로 여러분의 사진을 특별한 과학 컨셉의 네컷 사진으로 만들어 보세요.
        </p>

        <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white font-bold" onClick={handleStart}>
            시작하기
        </Button>

      </div>
    </div>
  );
}
