import { describe, it, expect, vi } from 'vitest';
import { UiExecutor } from '../ui.js';
import {
  buildMockCtx,
  buildMockPage,
  buildMockLocator,
  buildLoginPageObject,
} from '../../test-helpers.js';
import type { UiStep } from '../../types/index.js';

const executor = new UiExecutor();

const LOGIN_PAGE = buildLoginPageObject();

function ctxOnPage(currentUrl: string, locatorOverrides: Partial<ReturnType<typeof buildMockLocator>> = {}) {
  const locator = { ...buildMockLocator(), ...locatorOverrides };
  const page    = buildMockPage({
    url:              vi.fn().mockReturnValue(currentUrl),
    getByPlaceholder: vi.fn().mockReturnValue(locator),
    getByRole:        vi.fn().mockReturnValue(locator),
  });
  const pageObjects = new Map([['LoginPage', LOGIN_PAGE]]);
  return { ctx: buildMockCtx({ page, pageObjects, config: { baseUrl: 'https://app.test' } }), page, locator };
}

const loginStep: UiStep = { ui: { pageObject: 'LoginPage', action: 'login' } };

describe('UiExecutor — navigation guard', () => {
  it('navigates to page URL when not already on that page', async () => {
    const { ctx, page } = ctxOnPage('about:blank');
    await executor.execute(loginStep, ctx);
    expect(page.goto).toHaveBeenCalledWith('https://app.test/login');
  });

  it('does NOT navigate when already on the exact page URL', async () => {
    const { ctx, page } = ctxOnPage('https://app.test/login');
    await executor.execute(loginStep, ctx);
    expect(page.goto).not.toHaveBeenCalled();
  });

  it('normalises trailing slashes before comparing URLs', async () => {
    const { ctx, page } = ctxOnPage('https://app.test/login/');
    await executor.execute(loginStep, ctx);
    expect(page.goto).not.toHaveBeenCalled();
  });
});

describe('UiExecutor — actions', () => {
  it('executes fill action on the correct locator', async () => {
    const { ctx, locator } = ctxOnPage('https://app.test/login');
    await executor.execute(loginStep, ctx);
    expect(locator.fill).toHaveBeenCalledTimes(2);
  });

  it('executes click with waitForLoadState to handle navigation', async () => {
    const { ctx, page, locator } = ctxOnPage('https://app.test/login');
    await executor.execute(loginStep, ctx);
    expect(locator.click).toHaveBeenCalledTimes(1);
    expect(page.waitForLoadState).toHaveBeenCalledWith('domcontentloaded');
  });

  it('executes clear action', async () => {
    const { ctx, locator } = ctxOnPage('https://app.test/login');
    const step: UiStep = { ui: { pageObject: 'LoginPage', action: 'clearForm' } };
    await executor.execute(step, ctx);
    expect(locator.clear).toHaveBeenCalledTimes(2);
  });

  it('applies args overrides over action-level values', async () => {
    const { ctx, locator } = ctxOnPage('https://app.test/login');
    const step: UiStep = {
      ui: {
        pageObject: 'LoginPage',
        action:     'login',
        args:       { emailField: 'custom@test.com' },
      },
    };
    await executor.execute(step, ctx);
    expect(locator.fill).toHaveBeenNthCalledWith(1, 'custom@test.com');
  });
});

describe('UiExecutor — error handling', () => {
  it('throws when the page object is not registered', async () => {
    const ctx  = buildMockCtx();
    const step: UiStep = { ui: { pageObject: 'NonExistentPage', action: 'login' } };
    await expect(executor.execute(step, ctx)).rejects.toThrow(
      'Page object "NonExistentPage" not found',
    );
  });

  it('throws when the action does not exist on the page object', async () => {
    const pageObjects = new Map([['LoginPage', LOGIN_PAGE]]);
    const ctx = buildMockCtx({ pageObjects });
    const step: UiStep = { ui: { pageObject: 'LoginPage', action: 'nonExistentAction' } };
    await expect(executor.execute(step, ctx)).rejects.toThrow(
      'Action "nonExistentAction" not found on page object "LoginPage"',
    );
  });

  it('throws when a selector referenced in an action is not in the page object', async () => {
    const brokenPage = {
      ...LOGIN_PAGE,
      actions: {
        login: [{ action: 'click' as const, selector: 'missingSelector' }],
      },
    };
    const pageObjects = new Map([['LoginPage', brokenPage]]);
    const page = buildMockPage({ url: vi.fn().mockReturnValue('https://app.test/login') });
    const ctx  = buildMockCtx({ pageObjects, page, config: { baseUrl: 'https://app.test' } });
    await expect(executor.execute(loginStep, ctx)).rejects.toThrow(
      'Selector "missingSelector" not found',
    );
  });
});
