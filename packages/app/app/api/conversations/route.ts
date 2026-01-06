import type { Conversation } from '@muicv/shared';
import { inMemoryChatStore } from '@/src/server/in-memory-chat-store';

export const dynamic = 'force-dynamic';

const DEMO_USER_ID = 'demo';

export async function GET() {
  const conversations = inMemoryChatStore.listConversations(DEMO_USER_ID);
  return Response.json(conversations);
}

type CreateConversationBody = {
  title?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateConversationBody;

  const conversation: Conversation = inMemoryChatStore.createConversation({
    userId: DEMO_USER_ID,
    ...(body.title === undefined ? {} : { title: body.title }),
  });

  return Response.json(conversation, { status: 201 });
}
