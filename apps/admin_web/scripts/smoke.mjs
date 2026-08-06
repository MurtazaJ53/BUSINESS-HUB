#!/usr/bin/env node
/**
 * Request every page and API route and fail on any 5xx.
 *
 * This exists because a build that compiles is not a page that works. The
 * Hindi/Gujarati change compiled cleanly and then 500'd on every page at
 * runtime: `"use client"` marks every export of a module client-only, so the
 * server layout could not call a helper it imported. Only an actual request
 * found it.
 *
 * Usage:  node scripts/smoke.mjs [baseUrl]
 * Routes are discovered from the filesystem, so new pages are covered without
 * anyone remembering to add them here.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const APP = new URL("../src/app", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function toRoute(file) {
  const rel = relative(APP, file).split(sep).join("/");
  return "/" + rel.replace(/\/(page|route)\.tsx?$/, "").replace(/^\/+/, "");
}

const files = await walk(APP);

// Dynamic segments need a real id, so they are out of scope for a smoke run.
const pages = files
  .filter((f) => /[/\\]page\.tsx$/.test(f))
  .map(toRoute)
  .filter((r) => !r.includes("["))
  .map((r) => (r === "/" ? "/" : r));

const apis = [];
for (const file of files.filter((f) => /[/\\]route\.ts$/.test(f))) {
  const route = toRoute(file);
  if (route.includes("[")) continue;
  const src = await readFile(file, "utf8");
  if (/export async function GET/.test(src)) apis.push(route);
}

const all = [...new Set([...pages, ...apis])].sort();
const failures = [];

for (const route of all) {
  const url = `${BASE}${route}`;
  let label;
  try {
    const res = await fetch(url, { redirect: "manual" });
    label = String(res.status);
    // 401/403 are correct when signed out; 307 is the redirect to /login.
    if (res.status >= 500) failures.push({ route, status: res.status });
  } catch (err) {
    label = "UNREACHABLE";
    failures.push({ route, status: err.message });
  }
  process.stdout.write(`${label.padEnd(12)} ${route}\n`);
}

console.log(`\n${all.length} routes checked, ${failures.length} failing`);
if (failures.length) {
  for (const f of failures) console.error(`  ${f.status}  ${f.route}`);
  process.exit(1);
}
