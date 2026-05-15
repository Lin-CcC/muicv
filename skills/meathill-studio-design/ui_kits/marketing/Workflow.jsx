// Mui Studio marketing kit — Workflow numbered list

const WORKFLOW_STEPS = [
  { title: '导入现有简历或粘贴经历', desc: '不用先学概念。把你已经有的 PDF、文档或一段项目经历放进来，Mui 从真实材料开始整理。' },
  { title: '整理成可复用素材库',     desc: '经历、项目、技能会被拆成 Markdown 文件，存在你自己的电脑里。以后每次改简历都不用从头来。' },
  { title: '针对岗位生成、评审、导出', desc: '有了素材库，再贴岗位链接或描述，Mui 会生成版本、检查问题，并导出可以投递的 PDF。' },
];

function Workflow() {
  return (
    <section id="workflow" className="section">
      <div className="container">
        <div className="wf-grid">
          <div>
            <p className="eyebrow">— 怎么开始</p>
            <h2>第一次打开，<br className="md:hidden" /><Highlight>只做三件事</Highlight>。</h2>
          </div>
          <p className="lede">
            先完成第一份职业素材，不急着理解所有功能。后面的简历版本、岗位匹配和导出都会从这里长出来。
          </p>
        </div>
        <ol className="wf-list">
          {WORKFLOW_STEPS.map((step, i) => (
            <li key={step.title} className="wf-item">
              <span className="wf-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="wf-text">
                <b>{step.title}</b>
                <span className="sep">·</span>
                {step.desc}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

window.Workflow = Workflow;
