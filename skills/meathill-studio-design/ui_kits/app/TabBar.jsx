// App kit — Bottom tab bar

function TabBar({ active, onChange }) {
  const tabs = [
    { id: 'home',     label: '概览',  icon: 'home' },
    { id: 'chat',     label: '对话',  icon: 'chat' },
    { id: 'editor',   label: '素材',  icon: 'doc' },
    { id: 'settings', label: '设置',  icon: 'cog' },
  ];
  return (
    <nav className="m-tabbar">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)} className={active === t.id ? 'active' : ''}>
          <MIcon name={t.icon} size={22}/>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

window.TabBar = TabBar;
