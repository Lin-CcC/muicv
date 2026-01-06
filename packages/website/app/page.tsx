import { Button } from '@muicv/ui';

export default function WebsiteHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-start justify-center gap-6 p-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Mui简历</h1>
        <p className="text-zinc-600">不再填写冗长表单。通过 AI 就业辅导对话，自动记录关键信息并实时生成简历。</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button">进入应用</Button>
        <Button type="button" variant="secondary">
          查看定价
        </Button>
      </div>

      <div className="grid w-full grid-cols-3 gap-4 text-sm">
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="font-semibold">对话驱动</div>
          <div className="mt-1 text-zinc-600">像聊天一样梳理经历与目标。</div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="font-semibold">自动抽取</div>
          <div className="mt-1 text-zinc-600">系统整理要点，减少遗漏。</div>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <div className="font-semibold">实时预览</div>
          <div className="mt-1 text-zinc-600">随时查看简历成品与导出。</div>
        </div>
      </div>
    </main>
  );
}
