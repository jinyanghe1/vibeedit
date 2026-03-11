/**
 * Slate.js → Markdown / PlainText 序列化工具
 * 用于将富文本编辑器内容转换为 LLM 可理解的格式
 */
import type { Descendant } from 'slate';
import { Element, Node, Text } from 'slate';
import type { CustomElement, CustomText, ToneConfig } from '../types';
import { TONE_LABELS } from '../types';

/**
 * 将 Slate 节点树序列化为 Markdown 字符串
 * 保留格式标记供 LLM 理解文本结构和重点
 */
export function serializeToMarkdown(nodes: Descendant[]): string {
  return nodes.map(node => serializeNode(node)).join('\n');
}

function serializeNode(node: Descendant): string {
  if (Text.isText(node)) {
    return serializeTextNode(node as CustomText);
  }

  if (Element.isElement(node)) {
    const element = node as CustomElement;
    const childrenText = element.children
      .map(child => serializeNode(child as Descendant))
      .join('');

    switch (element.type) {
      case 'heading': {
        const level = 'level' in element ? element.level : 1;
        return `${'#'.repeat(level)} ${childrenText}`;
      }
      case 'blockquote':
        return `> ${childrenText}`;
      case 'paragraph':
      default:
        return childrenText;
    }
  }

  return '';
}

function serializeTextNode(node: CustomText): string {
  let text = node.text;
  if (!text) return '';

  if (node.bold) text = `**${text}**`;
  if (node.italic) text = `*${text}*`;
  if (node.underline) text = `__${text}__`;
  if (node.color) text = `[颜色:${node.color}]${text}[/颜色]`;
  if (node.highlight) text = `[高亮:${node.highlight}]${text}[/高亮]`;

  return text;
}

/**
 * 将 Slate 节点树序列化为纯文本（不含格式）
 */
export function serializeToPlainText(nodes: Descendant[]): string {
  return nodes.map(n => Node.string(n)).join('\n');
}

/**
 * 将调性配置转换为 LLM 可理解的中文描述段落
 */
export function toneConfigToPromptSegment(config: ToneConfig): string {
  const rhythmLabel = TONE_LABELS.rhythm.options[config.rhythm];
  const colorLabel = TONE_LABELS.colorTone.options[config.colorTone];
  const cameraLabel = TONE_LABELS.cameraStyle.options[config.cameraStyle];
  const narrativeLabel = TONE_LABELS.narrativeStyle.options[config.narrativeStyle];
  const visualLabel = TONE_LABELS.visualStyle.options[config.visualStyle];

  return `全局画面风格要求：
- 节奏: ${rhythmLabel}
- 色调: ${colorLabel}
- 镜头风格: ${cameraLabel}
- 叙事方式: ${narrativeLabel}
- 视觉风格: ${visualLabel}
请确保每个分镜的描述都体现上述风格特征。`;
}

/**
 * 创建默认的 Slate 编辑器初始值
 */
export function createInitialValue(): Descendant[] {
  return [
    {
      type: 'paragraph' as const,
      children: [{ text: '' }],
    },
  ];
}
