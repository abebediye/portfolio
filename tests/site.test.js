const assert = require("node:assert/strict");
const { readFileSync, readdirSync, statSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const pages = ["index.html", "experience.html", "education.html", "projects.html"];

function readPage(page) {
  return readFileSync(path.join(root, page), "utf8");
}

test("the portfolio includes all planned pages in Norwegian", () => {
  for (const page of pages) {
    const html = readPage(page);
    assert.match(html, /<html lang="no">/, `${page} should declare Norwegian`);
    assert.match(html, /<meta name="viewport"/, `${page} should support mobile`);
  }
});

test("all local links and linked anchors resolve", () => {
  for (const page of pages) {
    const html = readPage(page);
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
      if (/^(?:[a-z]+:|\/\/|#)/i.test(href)) {
        if (href.startsWith("#")) {
          assert.ok(ids.has(href.slice(1)), `${page} links to missing anchor ${href}`);
        }
        continue;
      }

      const [target, fragment] = href.split("#", 2);
      const targetPage = target || page;
      const targetPath = path.join(root, targetPage);
      assert.ok(statSync(targetPath).isFile(), `${page} links to missing file ${targetPage}`);

      if (fragment && targetPage.endsWith(".html")) {
        const targetHtml = readFileSync(targetPath, "utf8");
        assert.ok(
          new RegExp(`\\bid="${fragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(targetHtml),
          `${page} links to missing anchor ${href}`,
        );
      }
    }
  }
});

test("the homepage references the supplied potato image", () => {
  const html = readPage("index.html");
  assert.match(html, /<image\b[^>]*href="assets\/potato\.png"/);
  assert.ok(statSync(path.join(root, "assets", "potato.png")).isFile());
});

test("shared styles are loaded by every page", () => {
  for (const page of pages) {
    assert.match(readPage(page), /href="styles\.css"/, `${page} should load shared styles`);
  }
  assert.ok(readdirSync(root).includes("styles.css"));
});

test("GitHub Pages is configured for the apex custom domain", () => {
  assert.equal(readFileSync(path.join(root, "CNAME"), "utf8").trim(), "abebediye.no");
});
