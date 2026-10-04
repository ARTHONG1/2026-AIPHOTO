import { Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { source?: 'qr' | 'local'; className?: string };

export function PhotoPrivacyNotice({ source = 'qr', className }: Props) {
  const local = source === 'local';
  return (
    <aside aria-label="사진 보관과 전달 안내" className={cn('w-full rounded-2xl border border-cyan-400/25 bg-cyan-950/35 p-4 text-left', className)}>
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" aria-hidden />
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-bold leading-relaxed text-cyan-200">
            {local ? '선택한 사진은 외부 서버에 저장하지 않아요' : 'QR로 전달하는 사진은 외부 서버에 저장하지 않아요'}
          </p>
          <p className="text-xs leading-relaxed text-slate-300">
            {local ? '휴대폰에 있는 사진을 이 브라우저에서 열어요. 서버에 업로드하지 않고 스티커와 AR을 즐길 수 있어요.' : 'QR에는 사진 대신 연결 정보만 담아요. 부스 PC의 사진을 내 휴대폰으로 암호화해 전달해요.'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-black/15 px-3 py-2 text-xs leading-relaxed text-cyan-100">
        <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <p>사진은 화면에서만 잠시 열려요. 간직하려면 휴대폰에서 <strong>사진 저장</strong>을 눌러 주세요.</p>
      </div>
      <details className="mt-3 border-t border-cyan-400/15 pt-2 text-xs leading-relaxed text-slate-300">
        <summary className="cursor-pointer py-1 font-semibold text-cyan-200 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
          {local ? '사진은 어디에 보관되나요?' : '사진이 어떻게 전달되나요?'}
        </summary>
        <div className="mt-2 space-y-2">
          {local ? (
            <p>선택한 사진은 휴대폰 브라우저의 메모리에서만 열어요. 사진을 서버에 업로드하거나 저장하지 않아요.</p>
          ) : (
            <>
              <p><strong className="text-slate-100">QR은 두 기기를 연결하는 열쇠예요.</strong> 사진 파일이나 얼굴 정보가 들어 있지 않아요.</p>
              <p><strong className="text-slate-100">사진은 기기 사이에서 암호화해 전달해요.</strong> WebRTC라는 연결 기술을 사용해요. 서버는 연결을 돕고, AI한컷은 사진 파일을 서버에 보관하지 않아요. 네트워크에 따라 중계 서버가 연결을 도울 수 있어요.</p>
            </>
          )}
          <p><strong className="text-slate-100">자동으로 영구 저장하지 않아요.</strong> 브라우저 메모리에 잠시 열기 때문에 새로고침하거나 탭을 닫으면 이 화면의 사진이 사라져요. 직접 저장한 파일은 내 기기에 남아요.</p>
          {!local && <p className="border-t border-cyan-400/15 pt-2 text-[11px] text-slate-400">AI 사진을 만드는 단계에서는 합성을 위해 촬영 사진을 Google AI에 전송해요. 이 안내는 완성된 사진의 QR 전달과 앱의 보관 방식에 대한 설명이에요.</p>}
        </div>
      </details>
    </aside>
  );
}
