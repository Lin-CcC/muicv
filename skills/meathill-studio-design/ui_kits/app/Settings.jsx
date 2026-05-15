// App kit — Settings screen

function ScreenSettings() {
  return (
    <div className="app-screen" data-screen-label="App · Settings">
      <div className="app-scroll">
        <div className="m-head">
          <h1>设置</h1>
        </div>

        <div className="m-sec-h"><h2>账户</h2></div>
        <div className="m-list">
          <div className="m-row">
            <span className="ic warm" style={{ borderRadius: 999 }}>M</span>
            <span className="text">
              <span className="ti">Meathill</span>
              <span className="sb" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-soft)' }}>meathill@gmail.com · Pro 订阅</span>
            </span>
            <span className="ch"><MIcon name="chevron" size={16}/></span>
          </div>
        </div>

        <div className="m-sec-h"><h2>本月用量</h2></div>
        <div className="m-list">
          <div className="m-progress">
            <span className="bar"><span className="fill" style={{ width: '78%' }}/></span>
            <span className="pct">7,840 / 10,000</span>
          </div>
          <div className="m-row" style={{ borderTop: '1px solid var(--color-rule)' }}>
            <span className="ic"><MIcon name="download" size={16}/></span>
            <span className="text"><span className="ti">购买补充包</span><span className="sb" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-soft)' }}>10k / 35k / 130k tokens</span></span>
            <span className="ch"><MIcon name="chevron" size={16}/></span>
          </div>
        </div>

        <div className="m-sec-h"><h2>模型 · 通知 · 同步</h2></div>
        <div className="m-list">
          {[
            { ic: 'sparkle', label: '主模型',     sub: 'claude-sonnet-4.5' },
            { ic: 'user',    label: 'BYOK',       sub: '自带 LLM 余额（未配置）' },
            { ic: 'bell',    label: '完成评审通知', sub: '开启' },
            { ic: 'file',    label: '自动同步博客', sub: 'WordPress · 开启' },
          ].map((r) => (
            <div className="m-row" key={r.label}>
              <span className="ic"><MIcon name={r.ic} size={16}/></span>
              <span className="text">
                <span className="ti">{r.label}</span>
                <span className="sb" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-soft)' }}>{r.sub}</span>
              </span>
              <span className="ch"><MIcon name="chevron" size={16}/></span>
            </div>
          ))}
        </div>

        <div className="m-sec-h"><h2>关于</h2></div>
        <div className="m-list">
          <div className="m-row">
            <span className="ic warm"><img src="../../assets/mui-mascot.png" width="20" height="20" alt="" style={{ display: 'block' }}/></span>
            <span className="text"><span className="ti">Meathill Studio</span><span className="sb" style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-soft)' }}>v0.8.4 · 由柯基姆伊监修</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenSettings = ScreenSettings;
