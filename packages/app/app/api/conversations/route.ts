import type { Conversation } from '@muicv/shared';
import { getChatStore } from '@/src/server/chat-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEMO_USER_ID = 'demo';

export async function GET() {
  const conversations = await getChatStore().listConversations(DEMO_USER_ID);
  return Response.json(conversations);
}

type CreateConversationBody = {
  title?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CreateConversationBody;

  const conversation: Conversation = await getChatStore().createConversation({
    userId: DEMO_USER_ID,
    ...(body.title === undefined ? {} : { title: body.title }),
  });

  return Response.json(conversation, { status: 201 });
}
