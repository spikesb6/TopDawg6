import { describe, expect, it } from '@jest/globals';

import { analyticsEnabled, identify, toCapture, track } from './analytics';

describe('analytics', () => {
  it('is off without a PostHog key, and calls are safe no-ops', () => {
    expect(analyticsEnabled).toBe(false);
    expect(() => {
      track({ name: 'surprise_me' });
      identify('user-1');
      identify(null);
    }).not.toThrow();
  });

  it('sends the event name with the rest as properties', () => {
    expect(toCapture({ name: 'locked_in', mode: 'cook', kind: 'idea' })).toEqual([
      'locked_in',
      { mode: 'cook', kind: 'idea' },
    ]);
    expect(toCapture({ name: 'grocery_shared' })).toEqual(['grocery_shared', {}]);
  });
});
