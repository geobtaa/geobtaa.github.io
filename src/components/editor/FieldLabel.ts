import { createElement } from 'react';

export function FieldLabel({ text, required = false }: { text: string; required?: boolean }) {
  return createElement('span', { className: 'field-label' }, text,
    required && createElement('strong', { className: 'required-marker' }, ' Required'));
}
