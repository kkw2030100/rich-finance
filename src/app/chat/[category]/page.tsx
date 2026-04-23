import { chatCategories, getCategoryById } from '@/data/chat-categories';
import { ChatRoom } from '@/components/chat/ChatRoom';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return chatCategories.map(c => ({ category: c.id }));
}

export default async function ChatPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategoryById(category);
  if (!cat) notFound();
  return <ChatRoom category={cat} />;
}
