#!/usr/bin/env node
// Builds one static site per language from a single set of templates.
// Layout lives in src/templates + src/partials; text lives in src/i18n/<lang>.json.
const fs = require("node:fs");
const path = require("node:path");

const SRC = path.join(__dirname, "src");
const DEFAULT_LANGUAGE = "no";
const LANGUAGES = { no: { dir: "" }, en: { dir: "en" } };
const PAGES = ["index.html", "experience.html", "education.html", "projects.html"];
const STATIC_FILES = ["styles.css", "subpage.css", "assets", "CNAME"];

function flatten(object, prefix = "") {
  return Object.entries(object).reduce((flat, [key, value]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null
      ? { ...flat, ...flatten(value, name) }
      : { ...flat, [name]: value };
  }, {});
}

function render(template, view, partials = {}) {
  return template
    .replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
      return partials[name];
    })
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key) => {
      if (!(key in view)) throw new Error(`Missing translation key: ${key}`);
      return view[key];
    });
}

const readText = (...segments) => fs.readFileSync(path.join(...segments), "utf8");

function loadPartials() {
  const dir = path.join(SRC, "partials");
  return Object.fromEntries(
    fs.readdirSync(dir).map((file) => [path.basename(file, ".html"), readText(dir, file)]),
  );
}

const outputPath = (lang, page) => path.posix.join(LANGUAGES[lang].dir, page);

function pageUrl(site, lang, page) {
  const publicPath = page === "index.html" ? "" : page;
  const dir = LANGUAGES[lang].dir;
  return `https://${site}/${dir ? `${dir}/` : ""}${publicPath}`;
}

function createView({ lang, page, site, strings }) {
  const alt = Object.keys(LANGUAGES).find((code) => code !== lang);
  const fromDir = path.posix.dirname(outputPath(lang, page));
  const view = {
    ...strings,
    lang,
    altLang: alt,
    altHref: path.posix.relative(fromDir, outputPath(alt, page)),
    root: LANGUAGES[lang].dir ? "../" : "",
    "url.self": pageUrl(site, lang, page),
    "url.x-default": pageUrl(site, DEFAULT_LANGUAGE, page),
  };
  for (const code of Object.keys(LANGUAGES)) view[`url.${code}`] = pageUrl(site, code, page);
  for (const name of PAGES) {
    view[`active.${path.basename(name, ".html")}`] = name === page ? ' class="active"' : "";
  }
  return view;
}

function build({ outDir = path.join(__dirname, "dist") } = {}) {
  const site = readText(__dirname, "CNAME").trim();
  const partials = loadPartials();

  fs.rmSync(outDir, { recursive: true, force: true });

  for (const lang of Object.keys(LANGUAGES)) {
    const strings = flatten(JSON.parse(readText(SRC, "i18n", `${lang}.json`)));
    for (const page of PAGES) {
      const template = readText(SRC, "templates", page);
      const target = path.join(outDir, outputPath(lang, page));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, render(template, createView({ lang, page, site, strings }), partials));
    }
  }

  for (const entry of STATIC_FILES) {
    fs.cpSync(path.join(__dirname, entry), path.join(outDir, entry), { recursive: true });
  }
}

if (require.main === module) {
  build();
  console.log("Built site into dist/");
}

module.exports = { build, flatten, render, LANGUAGES, PAGES };
