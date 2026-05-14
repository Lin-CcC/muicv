import { JSON_TEMPLATE_IDS } from '@muicv/shared';

import { type JsonTemplateId, TEMPLATE_LABELS } from './tools';

export function TemplateSelect({ value, onChange }: { value: JsonTemplateId; onChange: (id: JsonTemplateId) => void }) {
  return (
    <label className="ml-auto inline-flex items-center gap-1.5 text-[11px]">
      <span className="text-mute">模板</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as JsonTemplateId)}
        className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink hover:bg-fluff focus:outline-none focus:ring-1 focus:ring-yellow-deep"
        title="切换在线预览使用的模板"
      >
        {JSON_TEMPLATE_IDS.map((id) => (
          <option key={id} value={id}>
            {TEMPLATE_LABELS[id]}
          </option>
        ))}
      </select>
    </label>
  );
}
