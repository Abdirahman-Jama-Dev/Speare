import { vi } from 'vitest';
import type { Page, BrowserContext, APIRequestContext } from 'playwright';
import type { RuntimeContext } from './types/execution-context.js';
import type { PageObjectDefinition } from './types/config.js';

// ─── Locator Mock ─────────────────────────────────────────────────────────────

export function buildMockLocator() {
  return {
    waitFor:       vi.fn().mockResolvedValue(undefined),
    textContent:   vi.fn().mockResolvedValue(''),
    inputValue:    vi.fn().mockResolvedValue(''),
    count:         vi.fn().mockResolvedValue(1),
    isEnabled:     vi.fn().mockResolvedValue(true),
    isChecked:     vi.fn().mockResolvedValue(false),
    fill:          vi.fn().mockResolvedValue(undefined),
    click:         vi.fn().mockResolvedValue(undefined),
    selectOption:  vi.fn().mockResolvedValue(undefined),
    check:         vi.fn().mockResolvedValue(undefined),
    uncheck:       vi.fn().mockResolvedValue(undefined),
    hover:         vi.fn().mockResolvedValue(undefined),
    press:         vi.fn().mockResolvedValue(undefined),
    clear:         vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Page Mock ────────────────────────────────────────────────────────────────

export function buildMockPage(overrides: Record<string, unknown> = {}): Page {
  const locator = buildMockLocator();
  return {
    goto:              vi.fn().mockResolvedValue(null),
    url:               vi.fn().mockReturnValue('about:blank'),
    waitForLoadState:  vi.fn().mockResolvedValue(undefined),
    unrouteAll:        vi.fn().mockResolvedValue(undefined),
    route:             vi.fn().mockResolvedValue(undefined),
    getByRole:         vi.fn().mockReturnValue(locator),
    getByText:         vi.fn().mockReturnValue(locator),
    getByLabel:        vi.fn().mockReturnValue(locator),
    getByPlaceholder:  vi.fn().mockReturnValue(locator),
    getByTestId:       vi.fn().mockReturnValue(locator),
    getByAltText:      vi.fn().mockReturnValue(locator),
    getByTitle:        vi.fn().mockReturnValue(locator),
    ...overrides,
  } as unknown as Page;
}

// ─── API Response Mock ────────────────────────────────────────────────────────

export function buildMockResponse(status = 200, body: unknown = {}) {
  return {
    status: vi.fn().mockReturnValue(status),
    json:   vi.fn().mockResolvedValue(body),
  };
}

// ─── API Context Mock ─────────────────────────────────────────────────────────

export function buildMockApiContext(defaultResponse = buildMockResponse()): APIRequestContext {
  return {
    get:    vi.fn().mockResolvedValue(defaultResponse),
    post:   vi.fn().mockResolvedValue(defaultResponse),
    put:    vi.fn().mockResolvedValue(defaultResponse),
    patch:  vi.fn().mockResolvedValue(defaultResponse),
    delete: vi.fn().mockResolvedValue(defaultResponse),
  } as unknown as APIRequestContext;
}

// ─── Runtime Context Mock ─────────────────────────────────────────────────────

export function buildMockCtx(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  const page       = overrides.page       ?? buildMockPage();
  const apiContext = overrides.apiContext ?? buildMockApiContext();
  const stepOutputs = (overrides.layers?.stepOutputs ?? {}) as Record<string, unknown>;

  const ctx: RuntimeContext = {
    config:         { baseUrl: 'https://example.com' },
    resolution:     { env: {}, testData: {}, stepOutputs },
    layers:         { env: {}, testData: {}, stepOutputs },
    page,
    browserContext: {} as BrowserContext,
    apiContext,
    pageObjects:    new Map<string, PageObjectDefinition>(),
    projectRoot:    '/test',
    testName:       'test',
    dbConnection:   null,
    resolve:        vi.fn().mockImplementation((v: unknown) => v),
    resolveDeep:    vi.fn().mockImplementation(<T>(v: T): T => v),
    save(key: string, value: unknown): RuntimeContext {
      return buildMockCtx({
        ...overrides,
        page:       ctx.page,
        apiContext: ctx.apiContext,
        layers: {
          env:         {},
          testData:    {},
          stepOutputs: { ...stepOutputs, [key]: value },
        },
      });
    },
    ...overrides,
  } as RuntimeContext;

  return ctx;
}

// ─── Page Object Fixture ──────────────────────────────────────────────────────

export function buildLoginPageObject(): PageObjectDefinition {
  return {
    name: 'LoginPage',
    url:  '/login',
    selectors: {
      emailField:    { type: 'placeholder', value: 'Email' },
      passwordField: { type: 'placeholder', value: 'Password' },
      submitButton:  { type: 'role',        value: 'button', options: { name: 'Login' } },
    },
    actions: {
      login: [
        { action: 'fill',  selector: 'emailField',    value: '{email}' },
        { action: 'fill',  selector: 'passwordField', value: '{password}' },
        { action: 'click', selector: 'submitButton' },
      ],
      clearForm: [
        { action: 'clear', selector: 'emailField' },
        { action: 'clear', selector: 'passwordField' },
      ],
    },
    requires: ['email', 'password'],
  };
}
