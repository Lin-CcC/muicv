// SaaS kit — Resume versions table page

function Versions() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? VERSIONS : VERSIONS.filter((v) => v.status === filter);

  return (
    <div data-screen-label="Versions">
      <div className="page-head">
        <div>
          <h1>简历版本</h1>
          <p className="sub">每个目标岗位生成一个版本，存在 <code>.claude/muicv/versions/</code>。</p>
        </div>
        <button className="btn btn-primary">{Icon('plus', 14)} 针对岗位生成</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', gap: 4, padding: 3, background: 'var(--color-paper)', border: '1px solid var(--color-rule)', borderRadius: 'var(--radius-md)' }}>
          {[
            ['all', '全部', VERSIONS.length],
            ['live', '已投递', VERSIONS.filter(v=>v.status==='live').length],
            ['review', '评审中', VERSIONS.filter(v=>v.status==='review').length],
            ['draft', '草稿', VERSIONS.filter(v=>v.status==='draft').length],
          ].map(([k, label, n]) => (
            <button key={k}
              onClick={() => setFilter(k)}
              style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: 0, font: 'inherit', fontSize: 12, fontWeight: 600,
                background: filter === k ? 'var(--color-yellow)' : 'transparent',
                color: filter === k ? 'var(--color-ink)' : 'var(--color-ink-soft)',
                boxShadow: filter === k ? '0 1px 0 0 var(--color-yellow-deep)' : 'none', cursor: 'pointer' }}>
              {label} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginLeft: 4, color: 'var(--color-mute)' }}>{n}</span>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-mute)' }}>{Icon('search', 14)}</span>
          <input className="input" style={{ paddingLeft: 32 }} placeholder="搜索版本名、目标岗位、标签…" />
        </div>
        <button className="btn">{Icon('download', 14)} 批量导出</button>
      </div>

      <section className="panel">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>版本</th><th>目标岗位</th><th>匹配度</th><th>STAR 评审</th><th>状态</th><th>修改时间</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.name} className={`row ${selected === v.name ? 'selected' : ''}`} onClick={() => setSelected(v.name)}>
                <td><input type="checkbox" style={{ accentColor: 'var(--color-yellow)' }} onClick={(e) => e.stopPropagation()} /></td>
                <td>
                  <div className="cell-pri">{v.name}</div>
                  <div className="cell-sub">{v.path}</div>
                </td>
                <td className="cell-num">{v.target}</td>
                <td className="cell-num">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 60, height: 6, borderRadius: 999, background: 'var(--color-rule)', overflow: 'hidden', display: 'inline-block' }}>
                      <span style={{ display: 'block', height: '100%', width: `${v.match}%`, background: v.match >= 75 ? 'var(--color-success)' : v.match >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }} />
                    </span>
                    <span style={{ minWidth: 32 }}>{v.match}%</span>
                  </span>
                </td>
                <td className="cell-num">
                  {v.star ? <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>{v.star}/7</span>
                          : <span style={{ color: 'var(--color-mute)' }}>—</span>}
                </td>
                <td>{statusPill(v.status)}</td>
                <td className="cell-num">{v.when}</td>
                <td><button className="btn btn-ghost btn-icon" onClick={(e) => e.stopPropagation()}>{Icon('chevron', 14)}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p style={{ marginTop: 14, fontSize: 12, color: 'var(--color-mute)', fontFamily: 'var(--font-mono)' }}>
        共 {filtered.length} 项 · 排序：最近修改
      </p>
    </div>
  );
}

const VERSIONS = [
  { name: 'SSR 工程师 · 字节跳动',  path: 'versions/bytedance-ssr.md', target: '字节跳动 · SSR',  match: 82, star: 6, status: 'live',   when: '3 分钟前' },
  { name: '全栈 lead · Linear',     path: 'versions/linear-lead.md',   target: 'Linear · Lead',    match: 71, star: 5, status: 'draft',  when: '今天 11:24' },
  { name: 'AI 工具方向 · Anthropic',path: 'versions/anthropic-ai.md',  target: 'Anthropic · AI',   match: 64, star: 5, status: 'review', when: '昨天' },
  { name: 'Cloudflare · Workers',   path: 'versions/cloudflare-w.md',  target: 'Cloudflare',       match: 48, star: 3, status: 'draft',  when: '2 天前' },
  { name: '通用 · 中文 v1',          path: 'versions/zh-general.md',    target: '通用',              match: 56, star: 0, status: 'live',   when: '上周' },
  { name: '前端架构师 · 美团',       path: 'versions/meituan-fe.md',    target: '美团 · 前端架构',   match: 67, star: 4, status: 'review', when: '上周' },
  { name: '远程 senior · GitLab',   path: 'versions/gitlab-remote.md', target: 'GitLab · Remote',  match: 73, star: 5, status: 'draft',  when: '上周' },
];

window.Versions = Versions;
