import { redirect } from 'next/navigation';

// Old guided-flow links now land on the new studio.
export default function EditorPage() {
  redirect('/studio');
}
