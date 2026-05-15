// Mui Studio marketing kit — Hero with rotating showcase

const { useState, useEffect, useRef } = React;

const SLIDES = [
  { key: 'import',  label: '导入素材' },
  { key: 'library', label: '素材库' },
  { key: 'resume',  label: '定制简历' },
];

function HeroShowcase() {
  const [active, setActive] = useState('import');
  const pausedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setActive((cur) => {
        const i = SLIDES.findIndex((s) => s.key === cur);
        return SLIDES[(i + 1) % SLIDES.length].key;
      });
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="showcase"
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}>
      <div className="showcase-mascot" style={{ display: window.innerWidth > 760 ? 'block' : 'none' }}>
        <CorgiMascot size={56} />
      </div>
      <div className="showcase-glow" aria-hidden />
      <div style={{ position: 'relative' }}>
        <div className="showcase-tabs">
          {SLIDES.map((s) => (
            <button key={s.key}
              className={`tab-chip ${active === s.key ? 'active' : ''}`}
              onClick={() => setActive(s.key)}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="showcase-frame">
          <div className="frame-titlebar">
            <div className="tl-dots">
              <span className="tl-dot" style={{ background: 'var(--color-tongue)' }} />
              <span className="tl-dot" style={{ background: 'var(--color-yellow)' }} />
              <span className="tl-dot" style={{ background: 'var(--color-corgi)' }} />
            </div>
            <span className="frame-meta">Mui简历 · 第一步</span>
          </div>
          <div className="frame-body">
            {active === 'import' && <ImportSlide />}
            {active === 'library' && <LibrarySlide />}
            {active === 'resume' && <ResumeSlide />}
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-mute)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: 'var(--color-yellow)' }} />
          先整理，再针对岗位迭代
        </div>
      </div>
    </div>
  );
}

function ImportSlide() {
  const items = [
    { title: '现有简历.pdf',   desc: '解析成可编辑素材' },
    { title: '一段项目经历',   desc: '补齐背景、动作、结果' },
    { title: '目标岗位链接',   desc: '之后用来生成版本' },
  ];
  return (
    <div>
      <h4 style={{ fontSize: 18, margin: 0, fontWeight: 800 }}>先放进来一份真实材料</h4>
      <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.65, color: 'var(--color-ink-soft)' }}>
        上传简历、粘贴经历，或者直接说"我想从零整理"。Mui 会从你已经有的内容开始。
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {items.map((it) => (
          <div key={it.title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-rule)', background: 'color-mix(in srgb, var(--color-paper) 70%, transparent)' }}>
            <span style={{ display: 'inline-flex', width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', background: 'var(--color-yellow)', color: 'var(--color-ink)' }}>
              <DocIcon className="" />
            </span>
            <span>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 14, color: 'var(--color-ink)' }}>{it.title}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--color-mute)' }}>{it.desc}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LibrarySlide() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
      <aside style={{ borderRight: '1px solid var(--color-rule)', paddingRight: 10, fontSize: 12 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--color-yellow-deep)', margin: 0 }}>导航</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li style={{ padding: '4px 8px', borderRadius: 4, background: 'color-mix(in srgb, var(--color-yellow) 30%, transparent)', color: 'var(--color-ink)', fontWeight: 700 }}>经历</li>
          <li style={{ padding: '4px 8px', color: 'var(--color-ink-soft)' }}>项目</li>
          <li style={{ padding: '4px 8px', color: 'var(--color-ink-soft)' }}>技能</li>
          <li style={{ padding: '4px 8px', color: 'var(--color-ink-soft)' }}>岗位</li>
        </ul>
      </aside>
      <div>
        <h4 style={{ fontSize: 14, margin: 0 }}>可复用素材</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { title: '负责会员增长实验平台', match: '已量化' },
            { title: '重构前端发布链路',     match: '可投递' },
            { title: '跨团队推进埋点规范',   match: '待补充' },
          ].map((it) => (
            <li key={it.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-rule)', background: 'var(--color-cream)', padding: '6px 10px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-ink)' }}>{it.title}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--color-yellow-deep)' }}>{it.match}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ResumeSlide() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '74%', borderRadius: 4, border: '1px solid var(--color-rule-strong)', background: 'var(--color-cream)', boxShadow: '0 3px 0 0 var(--color-ink)', position: 'relative', padding: '12px 16px' }}>
        <span style={{ position: 'absolute', right: 10, top: 10, padding: '1px 6px', borderRadius: 999, background: 'var(--color-yellow)', color: 'var(--color-ink)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>A4</span>
        <div style={{ height: 10, width: '60%', background: 'var(--color-ink)', borderRadius: 2 }}></div>
        <div style={{ height: 6, width: '40%', marginTop: 6, background: 'color-mix(in srgb, var(--color-mute) 50%, transparent)', borderRadius: 2 }}></div>
        <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
          {['React', 'TypeScript', 'Cloudflare'].map((s) => (
            <span key={s} style={{ padding: '1px 6px', borderRadius: 999, background: 'var(--color-fluff)', color: 'var(--color-yellow-deep)', fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 800, textTransform: 'uppercase' }}>{s}</span>
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ height: 6, width: '32%', background: 'color-mix(in srgb, var(--color-ink) 70%, transparent)', borderRadius: 2 }} />
              <div style={{ height: 5, width: 44, background: 'color-mix(in srgb, var(--color-mute) 35%, transparent)', borderRadius: 2 }} />
            </div>
            <div style={{ height: 5, marginTop: 5, width: '84%', background: 'color-mix(in srgb, var(--color-mute) 35%, transparent)', borderRadius: 2 }} />
            <div style={{ height: 5, marginTop: 4, width: '62%', background: 'color-mix(in srgb, var(--color-mute) 30%, transparent)', borderRadius: 2 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="hero-dots" aria-hidden />
      <div className="hero-paw tl"><PawIcon className="" /></div>
      <div className="hero-paw br"><PawIcon className="" /></div>
      <div className="container hero-inner">
        <div>
          <span className="eyebrow-badge"><Sparkle /> 桌面 app 已上线，先从一份素材开始</span>
          <h1>把简历和经历<br/><Highlight>交给 Mui 整理</Highlight>。</h1>
          <p className="lede">
            下载桌面 app，导入现有简历或粘贴一段经历。Mui 会先帮你整理成可复用的职业素材库，再针对不同岗位生成、评审和导出简历。
          </p>
          <div className="cta-row">
            <a href="#" className="btn-press">下载桌面 app <ArrowUpRight /></a>
            <a href="#workflow" className="btn-press btn-press-ink">看 3 步怎么开始 <ArrowUpRight /></a>
            <a href="#" className="btn-link-underline">已有账号？登录</a>
          </div>
          <p className="footnote">
            已经熟悉 Claude Code、Codex 或 Cursor？首页后面保留 skill 安装方式，可以继续走你习惯的工具链。
          </p>
        </div>
        <HeroShowcase />
      </div>
    </section>
  );
}

window.Hero = Hero;
