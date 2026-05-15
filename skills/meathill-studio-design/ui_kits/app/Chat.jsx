// App kit — Chat with Mui

const { useState: _useStateChat, useRef: _useRefChat, useEffect: _useEffectChat } = React;

function ScreenChat() {
  const [text, setText] = _useStateChat('');
  return (
    <div className="app-screen" data-screen-label="App · Chat">
      <div className="app-scroll">
        <div className="m-chat">
          <div className="m-msg">
            <div className="m-ava u">M</div>
            <div>
              <div><span className="who">我</span><span className="when">2m</span></div>
              <div className="body">帮我把 "重构发布链路" 改写成更适合投 SSR 工程师的版本。</div>
            </div>
          </div>

          <div className="m-msg">
            <div className="m-ava"><img src="../../assets/mui-mascot.png" width="20" height="20" alt="" style={{ display: 'block' }} /></div>
            <div>
              <div><span className="who ai">Mui</span><span className="when">2m · sonnet-4.5</span></div>
              <div className="body">好的。先把你的素材调出来比对一下原文。</div>
              <div className="m-tool" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MIcon name="file" size={14} />
                <span>read_file</span>
                <span className="arg">experience/refactor-release.md</span>
                <span className="ok">✓ 240ms</span>
              </div>
              <div className="m-thinking">分析素材<span className="dots"><span/><span/><span/></span></div>
            </div>
          </div>

          <div className="m-msg">
            <div className="m-ava"><img src="../../assets/mui-mascot.png" width="20" height="20" alt="" style={{ display: 'block' }} /></div>
            <div>
              <div><span className="who ai">Mui</span><span className="when">刚刚</span></div>
              <div className="body">
                我把首条 bullet 调到了 <b>SSR 视角</b>，并把数字前置。要不要直接覆盖到 SSR 版本，或者保留为对照？
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="m-btn ghost" style={{ flex: '0 0 auto', padding: '8px 14px', fontSize: 14 }}>保留对照</button>
                <button className="m-btn" style={{ flex: 1, padding: '8px 14px', fontSize: 14 }}>覆盖到 SSR 版本</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="m-composer">
        <div className="wrap">
          <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="给 Mui 一个目标 / 经历 / 问题…"/>
          <button className="send" aria-label="发送"><MIcon name="send" size={16}/></button>
        </div>
      </div>
    </div>
  );
}

window.ScreenChat = ScreenChat;
