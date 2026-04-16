export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col items-start justify-center gap-6 p-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Mui简历</h1>
        <p className="text-lg text-muted-foreground">
          在你熟悉的 AI agent 里管理简历。不必学新 UI、不必注册账号，
          简历素材以 Markdown 存在你自己的项目目录里，由你用 git 自己管理。
        </p>
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>当前正在从「Chatbot」重构为「Claude Code Skills + API」。</p>
        <p>安装方式与使用方法将在 README 中提供。</p>
      </div>
    </main>
  );
}
