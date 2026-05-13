import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode2, Info } from 'lucide-react';

import { generateSkillCode } from '@/lib/skill-codegen';
import { useSkillStore } from '@/stores/skill-store';

/**
 * Code View —— 只读 Monaco 编辑器（D-2 选项 1 + G 选项 1）。
 *
 * 顶部一条灰横条说明 v2 路线图；底部不显示行号 / 不允许折叠
 * 以匹配 B 端工具克制感。
 */
export function CodeView() {
  const config = useSkillStore((s) => s.config);
  const code = useMemo(() => generateSkillCode(config), [config]);

  return (
    <div className="flex h-full flex-col">
      {/* v2 提示横条 */}
      <div className="flex items-center gap-2 border-b border-border bg-bg/50 px-6 py-2">
        <Info className="h-3.5 w-3.5 text-muted" />
        <span className="text-[11px] leading-relaxed text-muted">
          当前为
          <span className="text-text">只读 Code View</span>
          ：所有修改请回到左侧 Low Code 模式。
          <span className="text-muted">双向编辑（代码 → LowCode）</span>
          在 v2 路线图。
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted">
          <FileCode2 className="h-3 w-3" />
          PurchaseFollowUpSkill.ts
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          value={code}
          language="typescript"
          theme="vs"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 12,
            fontFamily:
              "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            renderLineHighlight: 'none',
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            tabSize: 2,
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
          }}
          loading={
            <div className="flex h-full items-center justify-center text-[12px] text-muted">
              加载 Monaco 编辑器中…
            </div>
          }
        />
      </div>
    </div>
  );
}
