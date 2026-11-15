const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { build, flatten, render, LANGUAGES, PAGES } = require("../build");

const root = path.join(__dirname, "..");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-"));
build({ outDir });
test.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

const languageCodes = Object.keys(LANGUAGES);
const outputPath = (lang, page) => path.join(outDir, LANGUAGES[lang].dir, page);
const read = (lang, page) => fs.readFileSync(outputPath(lang, page), "utf8");
const loadStrings = (lang) =>
  flatten(JSON.parse(fs.readFileSync(path.join(root, "src", "i18n", `${lang}.json`), "utf8")));

function htmlFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}

test("render fills keys and partials", () => {
  assert.equal(render("a {{> p}} {{x.y}}", { "x.y": "1", z: "2" }, { p: "[{{z}}]" }), "a [2] 1");
});

test("render fails loudly on missing keys and partials", () => {
  assert.throws(() => render("{{missing}}", {}), /Missing translation key: missing/);
  assert.throws(() => render("{{> nope}}", {}, {}), /Unknown partial: nope/);
});

test("flatten turns nested objects into dotted keys", () => {
  assert.deepEqual(flatten({ a: { b: "x" }, c: "y" }), { "a.b": "x", c: "y" });
});

test("all languages define exactly the same non-empty keys", () => {
  const [first, ...others] = languageCodes.map(loadStrings);
  for (const other of others) {
    assert.deepEqual(Object.keys(other).sort(), Object.keys(first).sort());
  }
  for (const strings of [first, ...others]) {
    for (const [key, value] of Object.entries(strings)) {
      assert.ok(typeof value === "string" && value.trim(), `${key} should not be empty`);
    }
  }
});

test("every page is built for every language with the right lang attribute", () => {
  for (const lang of languageCodes) {
    for (const page of PAGES) {
      assert.match(read(lang, page), new RegExp(`<html lang="${lang}">`), `${lang}/${page}`);
    }
  }
});

test("no unresolved placeholders remain in the output", () => {
  for (const file of htmlFiles(outDir)) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\{\{/, file);
  }
});

test("translated pages differ from each other", () => {
  const heading = (lang, page) => read(lang, page).match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1];
  for (const page of PAGES) {
    assert.notEqual(heading("no", page), heading("en", page), page);
  }
});

test("all local links, assets and anchors resolve in the built site", () => {
  for (const file of htmlFiles(outDir)) {
    const html = fs.readFileSync(file, "utf8");
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

    for (const [, href] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) continue;
      if (href.startsWith("#")) {
        assert.ok(ids.has(href.slice(1)), `${file} links to missing anchor ${href}`);
        continue;
      }

      const [target, fragment] = href.split("#");
      const targetPath = path.resolve(path.dirname(file), target);
      assert.ok(fs.statSync(targetPath).isFile(), `${file} links to missing file ${href}`);

      if (fragment && targetPath.endsWith(".html")) {
        assert.match(
          fs.readFileSync(targetPath, "utf8"),
          new RegExp(`\\bid="${fragment}"`),
          `${file} links to missing anchor ${href}`,
        );
      }
    }
  }
});

test("each page links to its translation and declares alternates", () => {
  for (const page of PAGES) {
    for (const lang of languageCodes) {
      const html = read(lang, page);
      const alt = languageCodes.find((code) => code !== lang);
      const switchHref = html.match(/<a class="lang-switch" href="([^"]+)"/)[1];
      assert.equal(
        path.resolve(path.dirname(outputPath(lang, page)), switchHref),
        outputPath(alt, page),
        `${lang}/${page} switcher`,
      );
      for (const code of [...languageCodes, "x-default"]) {
        assert.match(html, new RegExp(`rel="alternate" hreflang="${code}"`), `${lang}/${page} ${code}`);
      }
    }
  }
});

test("the homepage shows the supplied potato image from every language", () => {
  for (const lang of languageCodes) {
    assert.match(read(lang, "index.html"), /<img\b[^>]*src="(?:\.\.\/)?assets\/potato\.png"/);
  }
  assert.ok(fs.statSync(path.join(outDir, "assets", "potato.png")).isFile());
});

test("shared styles are loaded by every page", () => {
  for (const lang of languageCodes) {
    const prefix = LANGUAGES[lang].dir ? "\\.\\./" : "";
    for (const page of PAGES) {
      assert.match(read(lang, page), new RegExp(`href="${prefix}styles\\.css"`), `${lang}/${page}`);
    }
  }
});

test("the apex custom domain is published with the site", () => {
  assert.equal(fs.readFileSync(path.join(outDir, "CNAME"), "utf8").trim(), "abebediye.no");
});

test("a GitHub Actions workflow builds and deploys the output", () => {
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "pages.yml"), "utf8");
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /upload-pages-artifact/);
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /deploy-pages/);
});
