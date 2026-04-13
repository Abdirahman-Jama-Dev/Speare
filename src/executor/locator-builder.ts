import type { Page } from 'playwright';
import type { SelectorDefinition } from '../types/index.js';

/**
 * Shared locator builder used by the assert and ui executors.
 * Centralises the mapping from SelectorDefinition → Playwright locator.
 */
export function buildLocatorFromDefinition(
  page: Page,
  selector: SelectorDefinition,
): ReturnType<Page['getByRole']> {
  const { type, value, options } = selector;

  switch (type) {
    case 'role':
      return page.getByRole(
        value as Parameters<Page['getByRole']>[0],
        options as Parameters<Page['getByRole']>[1],
      );
    case 'text':
      return page.getByText(value, options as Parameters<Page['getByText']>[1]);
    case 'label':
      return page.getByLabel(value, options as Parameters<Page['getByLabel']>[1]);
    case 'placeholder':
      return page.getByPlaceholder(value);
    case 'testId':
      return page.getByTestId(value);
    case 'alt':
      return page.getByAltText(value, options as Parameters<Page['getByAltText']>[1]);
    case 'title':
      return page.getByTitle(value, options as Parameters<Page['getByTitle']>[1]);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unsupported selector type: "${String(_exhaustive)}"`);
    }
  }
}
