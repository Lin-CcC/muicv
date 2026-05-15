// App kit — Material editor (mobile sheet style)

const { useState: _useStateEditor } = React;

function ScreenEditor() {
  const [title, setTitle] = _useStateEditor('重构前端发布链路');
  const [action, setAction] = _useStateEditor('把整包发布拆为按路由独立部署，引入 canary 流量与回滚开关。');
  const [result, setResult] = _useStateEditor('发布耗时 30min → 6min，回滚耗时 12min → 40s');
  const tags = ['前端架构', 'CI / CD', 'DX'];

  return (
    <div className="app-screen" data-screen-label="App · Editor">
      <div className="app-scroll">
        <div className="m-head" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 22 }}>编辑经历</h1>
            <p className="sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: 'var(--color-mute)', fontWeight: 700, marginTop: 2 }}>experience / 2024-q2.md</p>
          </div>
          <span className="m-pill ok"><span className="d" />已保存</span>
        </div>

        <div className="m-form">
          <div className="group">
            <div className="lbl">标题</div>
            <input className="ipt" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="group">
            <div className="lbl">动作（Action）</div>
            <textarea className="ta" rows={3} value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="group">
            <div className="lbl">结果（量化）</div>
            <input className="ipt" value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
          <div className="group">
            <div className="lbl">标签</div>
            <div className="tags">
              {tags.map((t) => <span key={t} className="tag">{t}</span>)}
              <span className="tag" style={{ background: 'transparent', color: 'var(--color-mute)' }}>+ 添加</span>
            </div>
          </div>
          <div className="group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="ic" style={{ background: 'var(--color-corgi)', color: 'var(--color-ink)', width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <MIcon name="sparkle" size={16}/>
            </span>
            <div style={{ flex: 1, fontSize: 14, color: 'var(--color-ink-soft)', lineHeight: 1.45 }}>
              这段经历目前 <b>STAR 5/7</b> · Mui 建议补一句"在公司发布事故占比"。
            </div>
          </div>
        </div>
      </div>

      <div className="m-fab-row">
        <button className="m-btn ghost" style={{ padding: '12px 16px', fontSize: 14, flex: '0 0 auto' }}>取消</button>
        <button className="m-btn"><MIcon name="check" size={16}/> 保存并关闭</button>
      </div>
    </div>
  );
}

window.ScreenEditor = ScreenEditor;
