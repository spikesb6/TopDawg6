// Builds src/data/content.json from ../content.js, the guidance the web app also uses.
// Run: npm run gen:content (a test fails if the JSON is out of date).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NAMES = ['PHASES', 'LOT_GROUPS', 'PERMITS', 'VETTING', 'CONTRACT', 'RED_FLAGS', 'PAY_RULES', 'PRINCIPLES', 'COST_SPLIT', 'DRAWS'];

function buildContent(source) {
  const result = vm.runInNewContext(`${source}\n;({ ${NAMES.join(', ')} })`, {});
  return JSON.stringify(result, null, 2) + '\n';
}

const SOURCE = path.join(__dirname, '../../content.js');
const OUT = path.join(__dirname, '../src/data/content.json');

if (require.main === module) {
  fs.writeFileSync(OUT, buildContent(fs.readFileSync(SOURCE, 'utf8')));
  console.log('Wrote', path.relative(process.cwd(), OUT));
}

module.exports = { buildContent, SOURCE, OUT };
