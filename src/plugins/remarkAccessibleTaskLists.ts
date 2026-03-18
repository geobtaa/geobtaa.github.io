import type { ListItem, Parent } from 'mdast';
import type { Plugin } from 'unified';
import { visitParents } from 'unist-util-visit-parents';

type HProperties = {
  className?: string | string[];
  [key: string]: unknown;
};

const SCREEN_READER_PREFIX_CLASS = 'visually-hidden';

const buildStatusPrefix = (checked: boolean) => ({
  type: 'mdxJsxTextElement',
  name: 'span',
  attributes: [{ type: 'mdxJsxAttribute', name: 'class', value: SCREEN_READER_PREFIX_CLASS }],
  children: [{ type: 'text', value: checked ? 'Completed: ' : 'Not completed: ' }],
});

const remarkAccessibleTaskLists: Plugin<[], Parent> = () => {
  return (tree) => {
    visitParents(tree, 'listItem', (node) => {
      const listItem = node as ListItem & { data?: { hProperties?: HProperties } };

      if (typeof listItem.checked !== 'boolean') return;

      const checked = listItem.checked;
      const firstChild = listItem.children[0];
      const hProperties = (listItem.data ??= {}).hProperties ?? ((listItem.data ??= {}).hProperties = {});
      const currentClasses = Array.isArray(hProperties.className)
        ? hProperties.className
        : typeof hProperties.className === 'string'
          ? [hProperties.className]
          : [];

      for (const className of ['task-list-item', checked ? 'task-list-item--checked' : 'task-list-item--unchecked']) {
        if (!currentClasses.includes(className)) currentClasses.push(className);
      }

      hProperties.className = currentClasses;
      hProperties['data-task-status'] = checked ? 'checked' : 'unchecked';

      if (
        firstChild?.type === 'paragraph' &&
        !firstChild.children.some(
          (child) =>
            child.type === 'mdxJsxTextElement' &&
            child.name === 'span' &&
            child.attributes.some(
              (attribute) =>
                attribute.type === 'mdxJsxAttribute' &&
                attribute.name === 'class' &&
                attribute.value === SCREEN_READER_PREFIX_CLASS,
            ),
        )
      ) {
        firstChild.children.unshift(buildStatusPrefix(checked) as never);
      }

      delete listItem.checked;
      delete (listItem as ListItem & { spread?: boolean }).spread;
    });
  };
};

export default remarkAccessibleTaskLists;
