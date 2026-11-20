import { FieldLabel } from './FieldLabel.ts';
import { createElement, useRef, type ChangeEvent, type FocusEvent } from 'react';
import { normalizeLinkAddress } from './linkAddress.ts';
import { COMPONENT_LINK_ERROR, isSafeComponentHref } from './componentLinkSafety.ts';

type Props = { value: string; onChange: (value: string) => void; required?: boolean };

export function LinkAddressField({ value, onChange, required = false }: Props) {
  const edited = useRef(false);
  const invalid = !isSafeComponentHref(value);
  return createElement('label', { className: 'link-address-field' }, createElement(FieldLabel, { text: 'URL', required }),
    createElement('input', {
      value, required, type: 'text', inputMode: 'url', autoCapitalize: 'none', spellCheck: false, 'aria-invalid': invalid || undefined,
      placeholder: 'example.com or /guides/help/',
      onChange: (event: ChangeEvent<HTMLInputElement>) => { edited.current = true; onChange(event.target.value); },
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        if (!edited.current) return;
        edited.current = false;
        const next = normalizeLinkAddress(event.currentTarget.value);
        if (next !== event.currentTarget.value) onChange(next);
      },
    }),
    createElement('span', invalid ? { role: 'alert' } : null, invalid ? COMPONENT_LINK_ERROR : 'Website addresses get https:// automatically.'),
  );
}
