// Meathill Studio marketing kit — Footer

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="foot-grid">
          <div>
            <a href="#" className="site-brand">
              <CorgiMascot size={36} />
              <span className="name" style={{ fontSize: 20 }}>Meathill Studio</span>
            </a>
            <p style={{ marginTop: 14, maxWidth: 360, fontSize: 14, lineHeight: 1.7, color: 'var(--color-ink-soft)' }}>
              个人工作室。做 AI 求职、博客 / CMS、效率工具的 SaaS 和桌面 app。
            </p>
            <p style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-yellow-deep)', textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: 800 }}>
              <PawIcon />
              由柯基 Mui 监修
            </p>
          </div>
          <div className="foot-cols">
            <div>
              <h4>产品</h4>
              <ul>
                <li><a href="#">Mui简历</a></li>
                <li><a href="#">山维空间博客</a></li>
                <li><a href="#">桌面 app</a></li>
                <li><a href="#">控制台</a></li>
              </ul>
            </div>
            <div>
              <h4>公司</h4>
              <ul>
                <li><a href="#">关于</a></li>
                <li><a href="#">联系</a></li>
              </ul>
            </div>
            <div>
              <h4>法律</h4>
              <ul>
                <li><a href="#">服务条款</a></li>
                <li><a href="#">隐私政策</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Meathill / Meathill Studio · 保留所有权利</span>
          <span>Made with 🐾 in 中国</span>
        </div>
      </div>
    </footer>
  );
}

window.Footer = Footer;
