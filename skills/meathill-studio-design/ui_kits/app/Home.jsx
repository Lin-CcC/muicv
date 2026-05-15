// App kit — Home (overview) screen

function ScreenHome({ go }) {
  return (
    <div className="app-screen" data-screen-label="App · Home">
      <div className="app-scroll">
        <div className="m-head">
          <h1>欢迎回来</h1>
          <p className="sub">本周整理了 4 段经历，针对 SSR / 全栈 lead 各生成 1 份版本。</p>
        </div>

        <div className="m-kpis">
          <div className="m-kpi"><span className="lbl">职业素材</span><div><span className="num">28</span><span className="delta">+4</span></div></div>
          <div className="m-kpi"><span className="lbl">本月 tokens</span><div><span className="num">7,840</span><span className="delta" style={{ color: 'var(--color-danger)' }}>−1.1k</span></div></div>
        </div>

        <div className="m-sec-h"><h2>最近的简历版本</h2><a onClick={(e) => { e.preventDefault(); go && go('editor'); }} href="#">查看全部</a></div>
        <div className="m-list">
          {[
            { name: 'SSR · 字节跳动',  path: 'versions/bytedance-ssr.md', status: 'ok',    label: '已投递' },
            { name: '全栈 lead · Linear', path: 'versions/linear-lead.md',   status: 'draft', label: '草稿' },
            { name: 'AI · Anthropic',  path: 'versions/anthropic-ai.md',  status: 'run',   label: '评审中' },
          ].map((v) => (
            <div className="m-row" key={v.name} onClick={() => go && go('editor')}>
              <span className="ic"><MIcon name="file" size={18}/></span>
              <span className="text">
                <span className="ti">{v.name}</span>
                <span className="sb">{v.path}</span>
              </span>
              <span className={`m-pill ${v.status}`}><span className="d" /> {v.label}</span>
              <span className="ch"><MIcon name="chevron" size={16}/></span>
            </div>
          ))}
        </div>

        <div className="m-sec-h"><h2>Mui 的建议</h2><a href="#">忽略</a></div>
        <div className="m-list">
          <div className="m-row" onClick={() => go && go('chat')}>
            <span className="ic warm"><MIcon name="sparkle" size={16}/></span>
            <span className="text">
              <span className="ti">把"重构发布链路"改写为 SSR 视角</span>
              <span className="sb" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-soft)', whiteSpace: 'normal' }}>素材里的"路由级 canary"+ "回滚 40s"非常贴合 SSR 性能岗。</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenHome = ScreenHome;
