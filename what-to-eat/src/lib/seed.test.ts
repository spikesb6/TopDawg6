import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';

import seed from '../data/seed-ideas.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildSeedSql } = require('../../scripts/gen-seed.js');

describe('supabase/seed.sql', () => {
  it('matches src/data/seed-ideas.json (run `npm run gen:seed` if this fails)', () => {
    const file = fs.readFileSync(path.join(__dirname, '../../supabase/seed.sql'), 'utf8');
    expect(file).toBe(buildSeedSql(seed));
  });
});
