import {
    Bold,
    Heading1, Heading2, Heading3,
    Highlighter,
    Italic,
    Palette,
    Quote,
    Underline
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Descendant } from 'slate';
import { createEditor, Editor, Element as SlateElement, Transforms } from 'slate';
import { withHistory } from 'slate-history';
import { Editable, Slate, withReact, type RenderElementProps, type RenderLeafProps } from 'slate-react';
import type { CustomElement, CustomText } from '../types';
import { createInitialValue } from '../utils/slateSerializer';

interface RichTextEditorProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  placeholder?: string;
}

// 颜色选项
const COLOR_OPTIONS = [
  { value: '#ef4444', label: '红' },
  { value: '#f97316', label: '橙' },
  { value: '#eab308', label: '黄' },
  { value: '#22c55e', label: '绿' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#8b5cf6', label: '紫' },
];

export { createInitialValue };

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useMemo(() => withHistory(withReact(createEditor())), []);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const renderElement = useCallback((props: RenderElementProps) => {
    const element = props.element as CustomElement;
    switch (element.type) {
      case 'heading': {
        const level = 'level' in element ? element.level : 1;
        const Tag = `h${level}` as 'h1' | 'h2' | 'h3';
        const sizes = { h1: 'text-2xl', h2: 'text-xl', h3: 'text-lg' };
        return <Tag {...props.attributes} className={`${sizes[Tag]} font-bold text-white mb-2`}>{props.children}</Tag>;
      }
      case 'blockquote':
        return <blockquote {...props.attributes} className="border-l-4 border-blue-500 pl-4 italic text-gray-300 my-2">{props.children}</blockquote>;
      default:
        return <p {...props.attributes} className="text-gray-200 mb-1 leading-relaxed">{props.children}</p>;
    }
  }, []);

  const renderLeaf = useCallback((props: RenderLeafProps) => {
    const leaf = props.leaf as CustomText;
    let { children } = props;

    if (leaf.bold) children = <strong>{children}</strong>;
    if (leaf.italic) children = <em>{children}</em>;
    if (leaf.underline) children = <u>{children}</u>;

    const style: React.CSSProperties = {};
    if (leaf.color) style.color = leaf.color;
    if (leaf.highlight) style.backgroundColor = leaf.highlight;

    return (
      <span {...props.attributes} style={style}>
        {children}
      </span>
    );
  }, []);

  // Toggle mark (bold, italic, underline)
  const toggleMark = (mark: keyof Omit<CustomText, 'text'>) => {
    const marks = Editor.marks(editor);
    const isActive = marks ? !!(marks as Record<string, unknown>)[mark] : false;
    if (isActive) {
      Editor.removeMark(editor, mark);
    } else {
      Editor.addMark(editor, mark, true);
    }
  };

  // 检查 mark 是否激活
  const isMarkActive = (mark: string): boolean => {
    const marks = Editor.marks(editor);
    return marks ? !!(marks as Record<string, unknown>)[mark] : false;
  };

  // Toggle block type
  const toggleBlock = (type: string, level?: number) => {
    const [match] = Editor.nodes(editor, {
      match: n => SlateElement.isElement(n) && (n as CustomElement).type === type,
    });

    if (match) {
      Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
    } else {
      const props: Partial<CustomElement> = level
        ? { type: 'heading', level: level as 1 | 2 | 3 } as Partial<CustomElement>
        : { type: type as 'paragraph' | 'blockquote' } as Partial<CustomElement>;
      Transforms.setNodes(editor, props);
    }
  };

  // 检查 block 是否激活
  const isBlockActive = (type: string, level?: number): boolean => {
    const [match] = Editor.nodes(editor, {
      match: n => {
        if (!SlateElement.isElement(n)) return false;
        const el = n as CustomElement;
        if (el.type !== type) return false;
        if (level && el.type === 'heading' && 'level' in el) return el.level === level;
        return true;
      },
    });
    return !!match;
  };

  // Set color
  const setColor = (color: string) => {
    Editor.addMark(editor, 'color', color);
    setShowColorPicker(false);
  };

  // Set highlight
  const setHighlight = (color: string) => {
    Editor.addMark(editor, 'highlight', color);
    setShowHighlightPicker(false);
  };

  const ToolbarButton = ({ active, onMouseDown, children, title }: {
    active?: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown(e);
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-gray-600 rounded-lg overflow-hidden bg-gray-900">
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 p-2 border-b border-gray-700 bg-gray-800/50 flex-wrap">
        <ToolbarButton active={isMarkActive('bold')} onMouseDown={() => toggleMark('bold')} title="加粗 (重点画面要素)">
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton active={isMarkActive('italic')} onMouseDown={() => toggleMark('italic')} title="斜体 (旁白/内心独白)">
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton active={isMarkActive('underline')} onMouseDown={() => toggleMark('underline')} title="下划线">
          <Underline size={16} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        <ToolbarButton active={isBlockActive('heading', 1)} onMouseDown={() => toggleBlock('heading', 1)} title="标题1 (场景分割)">
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton active={isBlockActive('heading', 2)} onMouseDown={() => toggleBlock('heading', 2)} title="标题2 (段落)">
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton active={isBlockActive('heading', 3)} onMouseDown={() => toggleBlock('heading', 3)} title="标题3">
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarButton active={isBlockActive('blockquote')} onMouseDown={() => toggleBlock('blockquote')} title="引用块 (旁白)">
          <Quote size={16} />
        </ToolbarButton>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* 颜色选择 */}
        <div className="relative">
          <ToolbarButton
            active={!!isMarkActive('color')}
            onMouseDown={() => setShowColorPicker(!showColorPicker)}
            title="文字颜色 (情绪标注)"
          >
            <Palette size={16} />
          </ToolbarButton>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 flex gap-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  className="w-6 h-6 rounded border border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  onMouseDown={(e) => { e.preventDefault(); setColor(c.value); }}
                />
              ))}
              <button
                className="w-6 h-6 rounded border border-gray-600 text-xs text-gray-400 hover:text-white"
                title="清除颜色"
                onMouseDown={(e) => { e.preventDefault(); Editor.removeMark(editor, 'color'); setShowColorPicker(false); }}
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* 高亮选择 */}
        <div className="relative">
          <ToolbarButton
            active={!!isMarkActive('highlight')}
            onMouseDown={() => setShowHighlightPicker(!showHighlightPicker)}
            title="高亮背景 (关键段落标记)"
          >
            <Highlighter size={16} />
          </ToolbarButton>
          {showHighlightPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 flex gap-1">
              {COLOR_OPTIONS.map(c => (
                <button
                  key={c.value}
                  className="w-6 h-6 rounded border border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.value + '40' }}
                  title={c.label}
                  onMouseDown={(e) => { e.preventDefault(); setHighlight(c.value + '40'); }}
                />
              ))}
              <button
                className="w-6 h-6 rounded border border-gray-600 text-xs text-gray-400 hover:text-white"
                title="清除高亮"
                onMouseDown={(e) => { e.preventDefault(); Editor.removeMark(editor, 'highlight'); setShowHighlightPicker(false); }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 格式说明 */}
      <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-800 bg-gray-900/50">
        💡 <strong className="text-gray-400">加粗</strong>=重点画面要素 | <em className="text-gray-400">斜体</em>=旁白/独白 | <span className="text-gray-400">标题</span>=场景分割 | <span className="text-red-400">颜色</span>=情绪标注
      </div>

      {/* 编辑区 */}
      <Slate editor={editor} initialValue={value} onChange={onChange}>
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          placeholder={placeholder || '输入富文本内容，使用工具栏标记重点...'}
          className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 text-gray-200 focus:outline-none [&_*::selection]:bg-blue-600/40"
          spellCheck={false}
        />
      </Slate>
    </div>
  );
}
