// SaaS kit — Empty placeholder for un-implemented sections

function Placeholder({ section }) {
  const meta = {
    materials: { title: '职业素材', sub: '把简历、项目经历、技能拆成可复用素材。',          icon: 'doc' },
    jobs:      { title: '岗位',     sub: '抓取的目标岗位，按匹配度排序。',                    icon: 'target' },
    sync:      { title: '同步',     sub: 'WordPress / Notion 同步状态与历史。',               icon: 'refresh' },
    billing:   { title: '订阅',     sub: 'Pro / Max 档位、token 包、BYOK 余额。',             icon: 'card' },
  }[section] || { title: section, sub: '', icon: 'doc' };

  return (
    <div data-screen-label={meta.title}>
      <div className="page-head">
        <div><h1>{meta.title}</h1><p className="sub">{meta.sub}</p></div>
        <button className="btn btn-primary">{Icon('plus', 14)} 新建</button>
      </div>
      <section className="panel">
        <div className="panel-body" style={{ padding: 56, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--color-fluff)', color: 'var(--color-yellow-deep)', alignItems: 'center', justifyContent: 'center', marginBottom: 14, border: '2px solid var(--color-corgi)' }}>
            {Icon(meta.icon, 26)}
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>这里会出现你的 {meta.title}</h3>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-mute)', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.65 }}>
            目前是占位空状态。在演示里只用来体现导航和布局；接入真实数据后这里会变成列表 / 表格 / 卡片网格。
          </p>
          <div style={{ marginTop: 18, display: 'inline-flex', gap: 8 }}>
            <button className="btn">查看文档</button>
            <button className="btn btn-primary">{Icon('plus', 14)} 立即添加</button>
          </div>
        </div>
      </section>
    </div>
  );
}

window.Placeholder = Placeholder;
