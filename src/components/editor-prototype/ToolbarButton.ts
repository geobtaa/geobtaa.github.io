import { createElement as h, type ButtonHTMLAttributes } from 'react';
import { TOOLBAR_ICONS, type ToolbarAction } from './toolbarIcons.ts';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & { action: ToolbarAction };

export function ToolbarButton({ action, className = '', ...props }: Props) {
  const { label, path } = TOOLBAR_ICONS[action];
  return h('button', { ...props, type: 'button', className: `toolbar-icon-button ${className}`.trim(), 'aria-label': label, title: label },
    h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: 'currentColor', 'aria-hidden': true, focusable: false }, h('path', { d: path })),
  );
}
