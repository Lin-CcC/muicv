// SaaS kit — Settings page (form-heavy)

function Settings() {
  const [notify, setNotify] = useState(true);
  const [autosync, setAutosync] = useState(true);
  const [experimental, setExperimental] = useState(false);

  return (
    <div data-screen-label="Settings">
      <div className="page-head">
        <div>
          <h1>设置</h1>
          <p className="sub">控制账户、模型路由、同步与通知。改动自动保存到 D1。</p>
        </div>
        <button className="btn">{Icon('check', 14)} 已保存</button>
      </div>

      <section className="panel" style={{ marginBottom: 16 }}>
        <header className="panel-head">
          <h3>账户</h3>
          <span className="meta">3 项</span>
        </header>
        <div className="panel-body">
          <div className="form-row">
            <div>
              <div className="lbl">显示名</div>
              <div className="hint">出现在 Mui 给你的反馈里。</div>
            </div>
            <div style={{ maxWidth: 360 }}>
              <input className="input" defaultValue="Meathill" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="lbl">邮箱</div>
              <div className="hint">用作登录与重要通知。</div>
            </div>
            <div style={{ maxWidth: 360 }}>
              <input className="input" type="email" defaultValue="meathill@gmail.com" />
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="lbl">默认语言</div>
              <div className="hint">UI 文案与 Mui 的输出语言。中英文以外的语言走 fallback。</div>
            </div>
            <div style={{ maxWidth: 360 }}>
              <select className="select" defaultValue="zh"><option value="zh">中文</option><option value="en">English</option><option value="ja">日本語</option></select>
            </div>
          </div>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <header className="panel-head">
          <h3>模型与 token</h3>
          <span className="meta">muirouter</span>
        </header>
        <div className="panel-body">
          <div className="form-row">
            <div>
              <div className="lbl">主模型</div>
              <div className="hint">用于素材整理、版本生成、评审。</div>
            </div>
            <div style={{ maxWidth: 360 }}>
              <select className="select"><option>claude-sonnet-4.5</option><option>gpt-4o</option><option>gemini-2.5-pro</option></select>
            </div>
          </div>
          <div className="form-row">
            <div>
              <div className="lbl">BYOK · 自定义 endpoint</div>
              <div className="hint">支持 OpenAI 兼容代理。绑定后 LLM 走你余额，PDF / JD 仍按 muicv tokens 扣。</div>
            </div>
            <div style={{ maxWidth: 460 }}>
              <input className="input" placeholder="https://api.openai.com/v1" />
              <input className="input" placeholder="sk-…" style={{ marginTop: 6 }} />
            </div>
          </div>
          <div className="form-row" style={{ alignItems: 'center' }}>
            <div>
              <div className="lbl">本月预算</div>
              <div className="hint">用量到达 80% 时通知；超出时暂停云端调用。</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360 }}>
              <input className="input" type="number" defaultValue={10000} style={{ width: 140 }} />
              <span style={{ fontSize: 14, color: 'var(--color-mute)' }}>tokens / 月</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h3>通知与同步</h3>
          <span className="meta">3 项</span>
        </header>
        <div className="panel-body">
          {[
            { label: '完成评审时通知',   hint: 'Mui 完成评审 / 改写建议后发邮件。',     on: notify,       set: setNotify },
            { label: '自动同步博客',     hint: '后台编辑器保存后自动推送至 WordPress。', on: autosync,    set: setAutosync },
            { label: '加入实验功能',     hint: '抢先体验 mock interview、cover letter。仍可能有 bug。', on: experimental, set: setExperimental },
          ].map((row) => (
            <div className="form-row" key={row.label} style={{ alignItems: 'center' }}>
              <div>
                <div className="lbl">{row.label}</div>
                <div className="hint">{row.hint}</div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={row.on} onChange={(e) => row.set(e.target.checked)} />
                <span className="track"></span>
                <span className="knob"></span>
              </label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

window.Settings = Settings;
