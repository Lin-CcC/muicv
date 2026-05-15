// SaaS kit — Dashboard overview (KPIs + activity + recent versions)

function Overview() {
  return (
    <div data-screen-label="Overview">
      <div className="page-head">
        <div>
          <h1>欢迎回来，Meathill</h1>
          <p className="sub">这周整理了 4 段经历，生成了 2 份针对 SSR 工程师 / 全栈 lead 的版本。</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn">{Icon('download', 14)} 导出报告</button>
          <button className="btn btn-primary">{Icon('plus', 14)} 新建版本</button>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><span className="lbl">职业素材</span>
          <span className="num">28<span className="delta">+4 本周</span></span>
        </div>
        <div className="kpi"><span className="lbl">简历版本</span>
          <span className="num">7<span className="delta">+2</span></span>
        </div>
        <div className="kpi"><span className="lbl">岗位匹配中</span>
          <span className="num">12<span className="delta">+3</span></span>
        </div>
        <div className="kpi"><span className="lbl">本月 tokens</span>
          <span className="num">7,840<span className="delta down">−1,160</span></span>
        </div>
      </div>

      <div className="panels">
        <section className="panel">
          <header className="panel-head">
            <h3>最近的简历版本</h3>
            <span className="meta">7 个 · 默认按修改时间倒序</span>
          </header>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr><th>版本</th><th>目标岗位</th><th>匹配度</th><th>状态</th><th>修改时间</th></tr>
              </thead>
              <tbody>
                {RECENT.map((r) => (
                  <tr key={r.name} className="row">
                    <td>
                      <div className="cell-pri">{r.name}</div>
                      <div className="cell-sub">{r.path}</div>
                    </td>
                    <td className="cell-num">{r.target}</td>
                    <td className="cell-num">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 60, height: 6, borderRadius: 999, background: 'var(--color-rule)', overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ display: 'block', height: '100%', width: `${r.match}%`, background: r.match >= 75 ? 'var(--color-success)' : r.match >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                        </span>
                        {r.match}%
                      </span>
                    </td>
                    <td>{statusPill(r.status)}</td>
                    <td className="cell-num">{r.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <h3>活动</h3>
            <span className="meta">最近 24 小时</span>
          </header>
          <div className="panel-body">
            <ul className="activity">
              {ACTIVITY.map((a, i) => (
                <li key={i}>
                  <span className="dot">{Icon(a.icon, 14)}</span>
                  <span className="desc"><b>{a.who}</b> {a.what}</span>
                  <span className="when">{a.when}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

const RECENT = [
  { name: 'SSR 工程师 · 字节跳动',  path: 'versions/bytedance-ssr.md',  target: '字节跳动 · SSR', match: 82, status: 'live',  when: '3 分钟前' },
  { name: '全栈 lead · Linear',     path: 'versions/linear-lead.md',    target: 'Linear · Lead',   match: 71, status: 'draft', when: '今天 11:24' },
  { name: 'AI 工具方向 · Anthropic',path: 'versions/anthropic-ai.md',   target: 'Anthropic · AI',  match: 64, status: 'review',when: '昨天' },
  { name: 'Cloudflare · Workers',   path: 'versions/cloudflare-w.md',   target: 'Cloudflare',      match: 48, status: 'draft', when: '2 天前' },
  { name: '通用 · 中文 v1',          path: 'versions/zh-general.md',     target: '通用',             match: 56, status: 'live',  when: '上周' },
];

function statusPill(s) {
  if (s === 'live')   return <span className="pill success"><span className="d" style={{background:'var(--color-success)'}}/>已投递</span>;
  if (s === 'review') return <span className="pill warn"><span className="d" style={{background:'var(--color-warning)'}}/>评审中</span>;
  if (s === 'draft')  return <span className="pill muted"><span className="d" style={{background:'var(--color-mute)'}}/>草稿</span>;
  return null;
}

const ACTIVITY = [
  { icon: 'check',    who: 'Mui',      what: '完成简历评审，给出 5 条改写建议',         when: '3m' },
  { icon: 'download', who: 'Meathill', what: '导出了 SSR 工程师 · 字节跳动 的 PDF',     when: '12m' },
  { icon: 'doc',      who: 'Mui',      what: '从 "重构发布链路" 经历里提炼了 3 条素材', when: '1h' },
  { icon: 'target',   who: 'Mui',      what: '抓取了 12 个新岗位，匹配度 50%+ 的 4 个', when: '今早' },
  { icon: 'refresh',  who: '系统',     what: '向 WordPress 推送了 3 篇博客同步',        when: '昨天' },
];

window.Overview = Overview;
