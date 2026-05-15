// Mui Studio marketing kit — Install / terminal section

function Install() {
  return (
    <section id="install" className="section" style={{ position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background:
        'radial-gradient(ellipse 90% 60% at 50% 0%, rgb(243 197 116 / 0.55) 0%, rgb(251 241 216 / 0.45) 35%, transparent 75%)',
        pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(circle, rgb(58 46 35 / 0.05) 1.2px, transparent 1.2px)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
      <div className="container" style={{ position: 'relative' }}>
        <div className="install">
          <div>
            <span className="install-pill"><span className="dot" />高级入口 · 给熟悉 AI 工具的人</span>
            <h2 style={{ marginTop: 18 }}>已经在用 Claude Code / Codex？<br/><Highlight>直接装 skill</Highlight>。</h2>
            <p className="lede">这是高级路径，适合已经习惯在 AI agent 里工作的用户。普通求职者直接下载桌面 app 会更顺。</p>
            <p style={{ marginTop: 12, fontSize: 14, color: 'var(--color-mute)' }}>
              不熟悉 AI agent？<a href="#" style={{ marginLeft: 4 }}>下载桌面 app</a> 直接开始，macOS / Windows / Linux 全平台可用。
            </p>
          </div>
          <div>
            <div className="term-card">
              <div className="term-head">
                <div>
                  <h3 style={{ fontSize: 16, margin: 0 }}>
                    npx skills
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 10, padding: '2px 9px', borderRadius: 999, background: 'var(--color-yellow)', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      <Sparkle /> 推荐
                    </span>
                  </h3>
                  <p style={{ margin: '4px 0 0' }} className="term-meta">多 agent 通用 / 40+ 兼容</p>
                </div>
              </div>
              <pre className="term-pre"><span className="prompt">$</span> npx skills add muicv -g{'\n'}<span className="ok">✓</span> installed muicv-core{'\n'}<span className="ok">✓</span> installed muicv-generate{'\n'}<span className="ok">✓</span> installed muicv-render</pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

window.Install = Install;
