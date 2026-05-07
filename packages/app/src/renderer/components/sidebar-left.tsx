import { ConversationList } from './conversation-list';
import { ProfileSection } from './sidebar-left-profile';
import { UserSection } from './sidebar-left-user';
import { UpdateCard } from './update-card';

/**
 * 左栏 IDE 风格 navigator：
 *   1. 顶部 profile 切换器（带文件树按钮）
 *   2. 中部对话列表
 *   3. 自动更新卡片（dev 模式不渲染）
 *   4. 底部用户菜单
 */
export function SidebarLeft() {
  return (
    <aside className="flex h-full w-full flex-col border-r-2 border-ink bg-cream/95">
      <ProfileSection />
      <div className="h-px bg-rule" />
      <ConversationList />
      <UpdateCard />
      <div className="h-px bg-rule" />
      <UserSection />
    </aside>
  );
}
