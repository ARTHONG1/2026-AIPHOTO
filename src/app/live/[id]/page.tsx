import type { Metadata } from 'next';
import Link from 'next/link';
import { getLivePhotoMeta } from '@/lib/storage';
import LivePhotoView from '@/components/live/live-photo-view';

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meta = await getLivePhotoMeta(id);

  if (!meta) {
    return {
      title: 'AI한컷 라이브 포토',
      description: '제28회 인천과학대제전 AI한컷 포토부스',
    };
  }

  return {
    title: '제28회 인천과학대제전 AI한컷 라이브 포토',
    description: '내가 주인공이 된 과학 포토부스 움직이는 라이브 사진을 확인해보세요.',
    openGraph: {
      title: '제28회 인천과학대제전 AI한컷 라이브 포토',
      description: '내가 주인공이 된 과학 포토부스 움직이는 라이브 사진',
      images: [
        {
          url: meta.photoUrl,
          width: 1200,
          height: 1800,
          alt: 'AI한컷 라이브 포토',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: '제28회 인천과학대제전 AI한컷 라이브 포토',
      description: '내가 주인공이 된 과학 포토부스 움직이는 라이브 사진',
      images: [meta.photoUrl],
    },
  };
}

export default async function LivePhotoPage({ params }: PageProps) {
  const { id } = await params;
  const meta = await getLivePhotoMeta(id);

  if (!meta) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#070b16] px-4 text-center text-slate-100">
        <div className="flex max-w-sm flex-col items-center gap-4 rounded-3xl border border-cyan-900/40 bg-slate-900/60 p-8 backdrop-blur">
          <span className="text-4xl">📸</span>
          <h1 className="text-xl font-bold text-cyan-300">사진을 찾을 수 없습니다</h1>
          <p className="text-sm text-slate-400">
            만료되었거나 아직 업로드 중인 사진일 수 있습니다. 다시 QR을 스캔해 주세요.
          </p>
          <Link
            href="/"
            className="mt-2 rounded-xl bg-cyan-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            처음으로 이동
          </Link>
        </div>
      </main>
    );
  }

  return <LivePhotoView meta={meta} />;
}

