import { createElement, useRef, type ChangeEvent, type FocusEvent } from 'react';
import { normalizeLinkAddress } from './linkAddress.ts';

type Props = { value: string; onChange: (value: string) => void; required?: boolean };

export function LinkAddressField({ value, onChange, required = false }: Props) {
  const edited = useRef(false);
  return createElement('label', { className: 'link-address-field' }, 'URL',
    createElement('input', {
      value, required, type: 'text', inputMode: 'url', autoCapitalize: 'none', spellCheck: false,
      placeholder: 'example.com or /guides/help/',
      onChange: (event: ChangeEvent<HTMLInputElement>) => { edited.current = true; onChange(event.target.value); },
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        if (!edited.current) return;
        edited.current = false;
        const next = normalizeLinkAddress(event.currentTarget.value);
        if (next !== event.currentTarget.value) onChange(next);
      },
    }),
    createElement('span', null, 'Website addresses get https:// automatically.'),
  );
}
