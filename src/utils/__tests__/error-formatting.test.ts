import { describe, it, expect } from 'vitest';
import { suggestSimilar, formatUnresolvedPlaceholderError } from '../error-formatting.js';

describe('suggestSimilar()', () => {
  it('returns exact match at distance 0', () => {
    expect(suggestSimilar('userId', ['userId', 'orderId'])).toContain('userId');
  });

  it('returns close matches (off by 1 character)', () => {
    const suggestions = suggestSimilar('userID', ['userId', 'token']);
    expect(suggestions).toContain('userId');
  });

  it('returns empty array when nothing is close', () => {
    expect(suggestSimilar('xyz', ['apple', 'banana', 'cherry'])).toHaveLength(0);
  });

  it('limits results to the specified limit', () => {
    const candidates = ['aa', 'ab', 'ac', 'ad'];
    expect(suggestSimilar('aa', candidates, 3, 2)).toHaveLength(2);
  });
});

describe('formatUnresolvedPlaceholderError()', () => {
  it('includes all required sections', () => {
    const message = formatUnresolvedPlaceholderError({
      placeholder: 'authToken',
      stepIndex: 5,
      stepType: 'api',
      stepOutputKeys: ['orderId'],
      testDataKeys: ['username', 'password'],
      envKeys: ['BASE_URL'],
    });

    expect(message).toContain('"authToken"');
    expect(message).toContain('step 5');
    expect(message).toContain('api');
    expect(message).toContain('step outputs');
    expect(message).toContain('test variables');
    expect(message).toContain('ENV.*');
  });

  it('includes suggestions when similar keys exist', () => {
    const message = formatUnresolvedPlaceholderError({
      placeholder: 'authTken',
      stepIndex: 0,
      stepType: 'ui',
      stepOutputKeys: ['authToken'],
      testDataKeys: [],
      envKeys: [],
    });
    expect(message).toContain('authToken');
  });
});
