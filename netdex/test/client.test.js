// Le code envoyé au navigateur doit se charger : une erreur de syntaxe casse tout le jeu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

const dir = new URL('../public/js/', import.meta.url);
for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  test(`syntaxe de public/js/${f}`, () => {
    const r = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: readFileSync(new URL(f, dir)) });
    assert.equal(r.status, 0, String(r.stderr));
  });
}
test('aucune mention des comptes d\'animation dans les fichiers servis', () => {
  for (const f of ['js/app.js', 'js/core.js', 'js/views.js', 'js/fun.js', 'js/chart.js', 'index.html', 'app.css', 'manifest.webmanifest', 'sw.js']) {
    const s = readFileSync(new URL('../public/' + f, import.meta.url), 'utf8').replace(/bottom|roboto/gi, '');
    assert.doesNotMatch(s, /bot|automatique/i, f);
  }
});
