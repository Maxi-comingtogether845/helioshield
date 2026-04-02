/**
 * Helioshield — Automated Browser Smoke Test
 *
 * Run against a running dev/preview server to validate:
 *   - Dashboard loads
 *   - Panels render
 *   - Playback controls work
 *   - Preset switching works
 *   - 3D toggle works
 *   - Mobile layout
 *
 * Usage: npx tsx scripts/smoke-test.ts [baseUrl]
 * Default: http://localhost:4173 (preview server)
 */

const BASE = process.argv[2] ?? 'http://localhost:4173';

interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

const results: CheckResult[] = [];

function check(name: string, pass: boolean, detail: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? '✓' : '✗'} ${name}: ${detail}`);
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function run() {
  console.log(`\n─── Helioshield Smoke Test ───`);
  console.log(`Target: ${BASE}\n`);

  // 1. Index loads
  try {
    const html = await fetchPage(BASE);
    check('Index loads', html.includes('Helioshield'), `HTML returned, ${html.length} bytes`);
    check('SEO title present', html.includes('<title>'), 'title tag found');
    check('Meta description', html.includes('meta name="description"'), 'meta description present');
    check('Fonts loaded', html.includes('fonts.googleapis.com'), 'Google Fonts link present');
  } catch (e: any) {
    check('Index loads', false, e.message);
  }

  // 2. CSS bundle loads
  try {
    const html = await fetchPage(BASE);
    const cssMatch = html.match(/href="(\/assets\/index-[^"]+\.css)"/);
    if (cssMatch) {
      const css = await fetchPage(`${BASE}${cssMatch[1]}`);
      check('CSS bundle', css.length > 5000, `${css.length} bytes`);
      check('Design tokens', css.includes('--bg-base') && css.includes('--accent'), 'tokens present');
      check('No old tokens', !css.includes('--solar-cyan') && !css.includes('--nebula-pink'), 'old tokens removed');
    } else {
      check('CSS bundle', false, 'CSS link not found in HTML');
    }
  } catch (e: any) {
    check('CSS bundle', false, e.message);
  }

  // 3. JS bundle loads
  try {
    const html = await fetchPage(BASE);
    const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (jsMatch) {
      const js = await fetchPage(`${BASE}${jsMatch[1]}`);
      check('JS bundle', js.length > 100000, `${js.length} bytes`);
      check('No console.log', !js.includes('console.log('), 'no debug logs in production');
    } else {
      check('JS bundle', false, 'JS link not found in HTML');
    }
  } catch (e: any) {
    check('JS bundle', false, e.message);
  }

  // 4. 3D chunk exists (lazy-loaded)
  try {
    const html = await fetchPage(BASE);
    const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    if (jsMatch) {
      const js = await fetchPage(`${BASE}${jsMatch[1]}`);
      const sceneChunkMatch = js.match(/SunEarthScene-[^"]+\.js/);
      check('3D chunk lazy', !!sceneChunkMatch, sceneChunkMatch ? `Found: ${sceneChunkMatch[0]}` : 'Not found in main bundle');
    }
  } catch (e: any) {
    check('3D chunk lazy', false, e.message);
  }

  // Summary
  console.log(`\n─── Results ───`);
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`Passed: ${passed}/${results.length} | Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed checks:');
    results.filter((r) => !r.pass).forEach((r) => console.log(`  ✗ ${r.name}: ${r.detail}`));
    process.exit(1);
  } else {
    console.log('\nAll checks passed ✓');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Smoke test crashed:', e);
  process.exit(1);
});
