// Mui Studio marketing kit — FAQ with collapsible items + side promo

const FAQ = [
  { q: '我的简历数据存在哪？谁能看到？',
    a: '全部存在你自己的电脑上——以纯 Markdown 文件的形式，由你完全掌握。要不要备份、要不要分享给别人，都由你决定。我们的服务器只在你主动调用导出 PDF / 抓取岗位等功能时短暂经手数据，处理完即丢弃，不留存任何简历内容。' },
  { q: '怎么收费？',
    a: '统一 token 钱包：注册一次性赠送 10,000 tokens，永不过期。订阅 Pro / Max 按周期自动续 token；BYOK 可绑定你自己的 API key，LLM 走你余额。具体看定价页。' },
  { q: '桌面 app 什么时候发布？',
    a: '已经上线，macOS / Windows / Linux 全平台可用。已经在用 AI agent 的用户也可以通过 skill 套件直接接入，二选一即可。' },
  { q: '会自动投递到 LinkedIn / Boss 直聘吗？',
    a: '不会。我们只帮你抓岗位、生成针对性简历、写求职信、整理 checklist——真正的"按提交按钮"由你手动完成。这是有意为之，避免账号风险和 ToS 违规。' },
  { q: '支持英文 / 双语简历吗？',
    a: '支持。素材是中文，简历就是中文；目标岗位是英文，生成的简历会按英文风格写；中英对照模板已在规划中。' },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section">
      <div className="container">
        <div className="faq">
          <div>
            <p className="eyebrow">— 常见问题</p>
            <h2>想问的<Highlight>大概率</Highlight>在这里。</h2>
            <div className="faq-list">
              {FAQ.map((item, i) => (
                <div key={item.q} className={`faq-item ${open === i ? 'open' : ''}`}>
                  <div className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                    <span className="qnum">Q{String(i + 1).padStart(2, '0')}</span>
                    <span className="qtext">{item.q}</span>
                    <span className="qplus">+</span>
                  </div>
                  <div className="faq-body">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
          <aside className="faq-side">
            <a href="#" className="aside-card" style={{ textDecoration: 'none' }}>
              <div className="blur" aria-hidden />
              <div style={{ position: 'absolute', right: 12, top: 12 }}><CorgiMascot size={42} /></div>
              <p className="eyebrow">— 桌面 App</p>
              <h3>桌面 app <span style={{ color: 'var(--color-yellow-deep)' }}>已上线</span>。</h3>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: 'var(--color-ink-soft)' }}>
                macOS / Windows / Linux 全平台可用。不想装 skill 也能用上同一套云端能力。
              </p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '8px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-yellow)', color: 'var(--color-ink)', fontWeight: 800, fontSize: 14, boxShadow: '0 2px 0 0 var(--color-yellow-deep)' }}>
                下载桌面 app <ArrowUpRight />
              </span>
            </a>
            <a href="#" className="aside-card" style={{ background: 'var(--color-cream)', boxShadow: '0 4px 0 0 var(--color-ink)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p className="eyebrow">— 定价</p>
                <p style={{ fontSize: 16, fontWeight: 800, margin: '6px 0 0', color: 'var(--color-ink)' }}>查看价格方案</p>
                <p style={{ fontSize: 12, color: 'var(--color-ink-soft)', margin: '2px 0 0' }}>Free / Pro / Max + BYOK</p>
              </div>
              <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: 'var(--color-yellow)', color: 'var(--color-ink)', boxShadow: '0 2px 0 0 var(--color-yellow-deep)' }}>
                <ArrowUpRight />
              </span>
            </a>
          </aside>
        </div>
      </div>
    </section>
  );
}

window.Faq = Faq;
