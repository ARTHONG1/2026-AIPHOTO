import Link from 'next/link';
export default function LegacyLivePhotoPage() {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[#070b16] px-6 text-center text-slate-100">
    <h1 className="font-display text-3xl text-cyan-300">사진을 서버에 보관하지 않아요</h1>
    <p>새 QR은 부스 화면이 열려 있는 동안 사진을 전달합니다.<br />이미 저장한 사진은 휴대폰에서 선택해 AR로 볼 수 있어요.</p>
    <Link href="/receive" className="btn-primary">저장한 사진으로 AR 열기</Link>
  </main>;
}
