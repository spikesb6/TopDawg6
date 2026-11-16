import { describe, expect, it } from '@jest/globals';
import fs from 'fs';

import { ALL_STEPS, PHASES, PRINCIPLES } from '@/data/content';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildContent, SOURCE, OUT } = require('../../scripts/gen-content.js');

describe('content.json', () => {
  it('matches ../content.js, the web app guidance (run `npm run gen:content` if this fails)', () => {
    expect(fs.readFileSync(OUT, 'utf8')).toBe(buildContent(fs.readFileSync(SOURCE, 'utf8')));
  });

  it('has unique step ids', () => {
    const ids = ALL_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links every principle to a real phase', () => {
    const phases = new Set(PHASES.map((p) => p.id));
    PRINCIPLES.forEach((p) => expect(phases.has(p.phase)).toBe(true));
  });
});
