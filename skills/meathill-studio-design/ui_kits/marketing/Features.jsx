// Mui Studio marketing kit — Features grid

const FEATURES = [
  { title: '整理职业素材', desc: '把现有简历、项目经历、技能和亮点拆成可复用素材。以后每次投递都从同一份底稿出发。', status: 'live', tags: ['导入简历', '补齐经历', '本地文件管理'], Icon: () => <DocIcon /> },
  { title: '针对岗位生成', desc: '给 Mui 一个目标岗位，它会从素材库挑选、排序、改写内容，生成一份更对得上的简历版本。', status: 'live', tags: ['岗位抓取', '匹配度评估', '版本化管理'], Icon: () => <TargetIcon /> },
  { title: '评审与导出',  desc: '按 STAR、量化、关键词、篇幅等维度检查草稿，再导出 A4 PDF，减少临投前的手忙脚乱。',     status: 'live', tags: ['7 维度评审', '修改建议', 'PDF 导出'], Icon: () => <ChatIcon /> },
  { title: '继续练习求职', desc: '素材稳定之后，可以继续做模拟面试、求职信和投递 checklist。高级能力会在你需要时出现。', status: 'soon', tags: ['模拟面试', '求职信', '投递 checklist'], Icon: () => <CompassIcon /> },
];

function Features() {
  return (
    <section id="features" className="section">
      <div className="container">
        <div style={{ display: 'grid', gap: 32, gridTemplateColumns: '1fr', alignItems: 'start' }} className="feat-head-grid">
          <div>
            <p className="eyebrow">— 能做什么</p>
            <h2>先把素材理顺，<br/><Highlight>再处理投递</Highlight>。</h2>
            <p className="lede">Mui 的核心不是替你编故事，而是把真实经历整理成可复用素材，再根据不同岗位调整表达。</p>
          </div>
        </div>
        <div className="feat-grid">
          {FEATURES.map((f) => {
            const Icon = f.Icon;
            const isLive = f.status === 'live';
            return (
              <article key={f.title} className="feat-card">
                <div className="feat-head">
                  <span className="feat-icon"><Icon /></span>
                  <span className={`feat-status ${f.status}`}>
                    <span className="ds" style={{ background: isLive ? 'var(--color-yellow-deep)' : 'var(--color-mute)' }} />
                    {isLive ? '已上线' : '即将推出'}
                  </span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <ul className="feat-tags">
                  {f.tags.map((t) => <li key={t} className="feat-tag">{t}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

window.Features = Features;
