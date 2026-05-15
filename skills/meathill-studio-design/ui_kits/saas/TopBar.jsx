// SaaS kit — Top bar (breadcrumbs + actions)

function TopBar({ section, onNewVersion }) {
  const titles = {
    overview:  ['控制台', '概览'],
    materials: ['控制台', '职业素材'],
    versions:  ['控制台', '简历版本'],
    jobs:      ['控制台', '岗位'],
    sync:      ['控制台', '同步'],
    billing:   ['控制台', '订阅'],
    settings:  ['控制台', '设置'],
  };
  const path = titles[section] || titles.overview;
  return (
    <header className="topbar">
      <div className="crumbs">
        {path.map((p, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === path.length - 1 ? 'here' : ''}>{p}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="tb-actions">
        <button className="btn btn-ghost btn-icon" title="通知">
          {Icon('bell', 16)}
        </button>
        <button className="btn">
          {Icon('upload', 14)} 导入简历
        </button>
        <button className="btn btn-primary" onClick={onNewVersion}>
          {Icon('plus', 14)} 新建版本
        </button>
      </div>
    </header>
  );
}

window.TopBar = TopBar;
