// Meathill Studio marketing kit — top header

function Header() {
  const links = [
    { label: '怎么开始', href: '#workflow' },
    { label: '能做什么', href: '#features' },
    { label: '价格', href: '#' },
    { label: '下载', href: '#' },
  ];
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a href="#" className="site-brand">
          <CorgiMascot size={32} />
          <span className="name">Meathill Studio</span>
          <span className="by">by Mui 🐾</span>
        </a>
        <nav className="site-nav">
          {links.map((l) => <a key={l.label} href={l.href}>{l.label}</a>)}
          <a href="#" className="btn-press" style={{ padding: '6px 12px', marginLeft: 8, fontSize: 14 }}>
            创建账号 <ArrowUpRight />
          </a>
        </nav>
      </div>
    </header>
  );
}

window.Header = Header;
