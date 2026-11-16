import { describe, expect, it } from '@jest/globals';

import { permitsFor } from '@/lib/permits';
import { freshState } from '@/lib/state';

const ids = (p: Parameters<typeof permitsFor>[0]) => permitsFor(p).map((x) => x.id);

describe('permits', () => {
  const base = freshState().profile;

  it('swaps tap permits for septic and well on private utilities', () => {
    expect(ids(base)).toContain('tap');
    expect(ids(base)).not.toContain('septic');
    const priv = ids({ ...base, utilities: 'private' });
    expect(priv).toEqual(expect.arrayContaining(['septic', 'well']));
    expect(priv).not.toContain('tap');
  });

  it('adds HOA, flood and stormwater permits only when they apply', () => {
    expect(ids(base)).not.toEqual(expect.arrayContaining(['hoa']));
    expect(ids({ ...base, hoa: true, flood: true, acre: true })).toEqual(
      expect.arrayContaining(['hoa', 'flood', 'npdes']),
    );
  });

  it('always includes the building permit and certificate of occupancy', () => {
    expect(ids(base)).toEqual(expect.arrayContaining(['building', 'co']));
  });
});
