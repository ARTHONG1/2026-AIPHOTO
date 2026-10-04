import { ReceivePhoto } from '@/components/live/receive-photo';
export default async function ReceivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceivePhoto id={id} />;
}
