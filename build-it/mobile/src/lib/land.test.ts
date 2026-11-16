import { describe, expect, it } from '@jest/globals';

import { LOT_GROUPS } from '@/data/content';
import { lotCounts, lotVerdict } from '@/lib/land';

const ids = LOT_GROUPS.flatMap((g) => g.items.map((i) => i.id));

describe('land check', () => {
  it('starts in due diligence', () => {
    expect(lotVerdict({}).tone).toBe('plain');
    expect(lotCounts({}).unknown).toBe(ids.length);
  });

  it('a single deal-breaker wins over everything', () => {
    const lot = Object.fromEntries(ids.map((id) => [id, 'ok' as const]));
    expect(lotVerdict(lot).tone).toBe('ok');
    expect(lotVerdict({ ...lot, [ids[0]]: 'concern' }).tone).toBe('warn');
    expect(lotVerdict({ ...lot, [ids[0]]: 'concern', [ids[1]]: 'nogo' }).tone).toBe('bad');
  });
});
