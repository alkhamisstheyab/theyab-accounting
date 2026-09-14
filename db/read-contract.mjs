/**
 * يقرأ نصّ عقدٍ من ملف PDF بترتيبه على الورقة.
 *
 *   node db/read-contract.mjs <ملف.pdf> [صفحات] 
 *
 * العربية في هذه الملفات مخزّنة بترتيبٍ بصريّ معكوس، فتُعاد إلى
 * ترتيبها المنطقي. و XY=1 يُظهر إحداثيات كل نصّ — تلزم لقراءة
 * الجداول: العمود يُعرف بموضعه لا بترتيبه في الملف.
 */
import fs from "fs";
import zlib from "zlib";

const file = process.argv[2];
const s = fs.readFileSync(file).toString("latin1");

const objs = new Map();
{
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(s))) {
    const start = m.index + m[0].length;
    const end = s.indexOf("endobj", start);
    objs.set(Number(m[1]), s.slice(start, end < 0 ? s.length : end));
  }
}

function streamOf(body) {
  if (!body) return null;
  const i = body.indexOf("stream");
  if (i < 0) return null;
  let j = i + 6;
  if (body[j] === "\r") j++;
  if (body[j] === "\n") j++;
  const k = body.lastIndexOf("endstream");
  if (k < 0) return null;
  let raw = Buffer.from(body.slice(j, k), "latin1");
  if (/\/Filter\s*(\[\s*)?\/FlateDecode/.test(body.slice(0, i))) {
    try {
      raw = zlib.inflateSync(raw);
    } catch {
      try {
        raw = zlib.inflateRawSync(raw);
      } catch {
        return null;
      }
    }
  }
  return raw;
}

const hexToStr = (h) => {
  let out = "";
  for (let i = 0; i + 4 <= h.length; i += 4) out += String.fromCharCode(parseInt(h.substr(i, 4), 16));
  return out;
};

/** يفكّ bfchar و bfrange بصيغتيها: وجهة واحدة، أو مصفوفة وجهات. */
function parseCMap(data) {
  const t = data.toString("latin1");
  const map = new Map();
  for (const blk of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const toks = blk[1].match(/<[0-9A-Fa-f]*>/g) || [];
    for (let i = 0; i + 1 < toks.length; i += 2) {
      map.set(parseInt(toks[i].slice(1, -1), 16), hexToStr(toks[i + 1].slice(1, -1)));
    }
  }
  for (const blk of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const toks = blk[1].match(/<[0-9A-Fa-f]*>|\[|\]/g) || [];
    let i = 0;
    while (i < toks.length) {
      if (toks[i] === "[" || toks[i] === "]") { i++; continue; }
      const lo = parseInt(toks[i].slice(1, -1), 16);
      const hi = parseInt(toks[i + 1].slice(1, -1), 16);
      i += 2;
      if (toks[i] === "[") {
        i++;
        let c = lo;
        while (i < toks.length && toks[i] !== "]") {
          map.set(c++, hexToStr(toks[i].slice(1, -1)));
          i++;
        }
        i++;
      } else {
        const base = hexToStr(toks[i].slice(1, -1));
        i++;
        for (let c = lo; c <= hi; c++) {
          const u = base.split("");
          u[u.length - 1] = String.fromCharCode(base.charCodeAt(base.length - 1) + (c - lo));
          map.set(c, u.join(""));
        }
      }
    }
  }
  return map;
}

const cmapByFont = new Map();
for (const [num, body] of objs) {
  const tu = body.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
  if (!tu) continue;
  const st = streamOf(objs.get(Number(tu[1])));
  if (st) cmapByFont.set(num, parseCMap(st));
}
if (process.env.DBG) for (const [k, v] of cmapByFont) console.error("font", k, "glyphs", v.size);

function fontsFor(resBody) {
  const out = new Map();
  const fm = resBody.match(/\/Font\s*<<([\s\S]*?)>>/);
  let inner = fm ? fm[1] : null;
  if (!inner) {
    const fr = resBody.match(/\/Font\s+(\d+)\s+0\s+R/);
    if (fr) inner = objs.get(Number(fr[1])) || "";
  }
  if (!inner) return out;
  for (const p of inner.matchAll(/\/(\w+)\s+(\d+)\s+0\s+R/g)) out.set(p[1], cmapByFont.get(Number(p[2])) || null);
  return out;
}

const pages = [];
for (const [num, body] of objs) if (/\/Type\s*\/Page[^s]/.test(body)) pages.push([num, body]);
pages.sort((a, b) => a[0] - b[0]);

function contentOf(body) {
  const c = body.match(/\/Contents\s+(\d+)\s+0\s+R/);
  if (c) return streamOf(objs.get(Number(c[1])));
  const arr = body.match(/\/Contents\s*\[([^\]]*)\]/);
  if (arr) {
    const parts = [...arr[1].matchAll(/(\d+)\s+0\s+R/g)].map((x) => streamOf(objs.get(Number(x[1]))));
    return Buffer.concat(parts.filter(Boolean));
  }
  return null;
}

function resourcesOf(body) {
  const r = body.match(/\/Resources\s+(\d+)\s+0\s+R/);
  if (r) return objs.get(Number(r[1])) || "";
  const i = body.indexOf("/Resources");
  return i < 0 ? "" : body.slice(i, i + 4000);
}

const only = process.argv[3] ? process.argv[3].split(",").map(Number) : null;
const TOK = /<[0-9A-Fa-f\s]*>|\(([^()\\]|\\[\s\S])*\)|\/[^\s/[\]<>()]+|[-+\d.]+|\[|\]|[A-Za-z'"*]+/g;

pages.forEach(([num, body], idx) => {
  const pageNo = idx + 1;
  if (only && !only.includes(pageNo)) return;
  const data = contentOf(body);
  if (!data) return;
  const fonts = fontsFor(resourcesOf(body));
  const content = data.toString("latin1");
  const items = [];
  let cur = null;
  let tm = [1, 0, 0, 1, 0, 0];
  let tlm = tm.slice();
  let leading = 0;
  let stack = [];
  let col = "";
  const toks = content.match(TOK) || [];
  for (const tk of toks) {
    if (/^[-+\d.]+$/.test(tk) || tk === "[" || tk === "]" || tk[0] === "/" || tk[0] === "(" || tk[0] === "<") {
      stack.push(tk);
      continue;
    }
    const op = tk;
    const n = (i) => Number(stack[stack.length - i]);
    if (op === "rg") col = [n(3), n(2), n(1)].map((v) => Math.round(v * 255)).join(",");
    else if (op === "g") col = "gray" + n(1);
    else if (op === "Tf") cur = fonts.get(String(stack[stack.length - 2] || "").slice(1)) ?? null;
    else if (op === "Tm") { tm = [n(6), n(5), n(4), n(3), n(2), n(1)]; tlm = tm.slice(); }
    else if (op === "Td" || op === "TD") {
      if (op === "TD") leading = -n(1);
      tlm = [tlm[0], tlm[1], tlm[2], tlm[3], tlm[0] * n(2) + tlm[2] * n(1) + tlm[4], tlm[1] * n(2) + tlm[3] * n(1) + tlm[5]];
      tm = tlm.slice();
    } else if (op === "TL") leading = n(1);
    else if (op === "T*") {
      tlm = [tlm[0], tlm[1], tlm[2], tlm[3], tlm[2] * -leading + tlm[4], tlm[3] * -leading + tlm[5]];
      tm = tlm.slice();
    } else if (op === "BT") { tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); }
    else if (op === "Tj" || op === "TJ" || op === "'" || op === '"') {
      let seq;
      const close = stack.lastIndexOf("]");
      if (close >= 0) {
        const open = stack.lastIndexOf("[");
        seq = stack.slice(open + 1, close);
      } else seq = [stack[stack.length - 1]];
      let text = "";
      for (const t of seq) {
        if (typeof t !== "string") continue;
        if (t[0] === "<") {
          const h = t.slice(1, -1).replace(/\s/g, "");
          for (let k = 0; k + 4 <= h.length; k += 4) {
            const code = parseInt(h.substr(k, 4), 16);
            text += cur ? cur.get(code) ?? "•" : String.fromCharCode(code);
          }
        } else if (t[0] === "(") {
          for (const ch of t.slice(1, -1)) text += cur ? cur.get(ch.charCodeAt(0)) ?? ch : ch;
        }
      }
      if (text.trim()) items.push({ x: Math.round(tm[4]), y: Math.round(tm[5]), text, col });
    }
    stack = [];
  }
  const lines = new Map();
  for (const it of items) {
    const key = Math.round(it.y / 5) * 5;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(it);
  }
  console.log("=== صفحة " + pageNo + " ===");
  const AR = /[؀-ۿﭐ-﻿]/;
  const logical = (t) => (AR.test(t) ? [...t].reverse().join("") : t);
  [...lines.entries()]
    .sort((a, b) => b[0] - a[0])
    .forEach(([y, arr]) => {
      arr.sort((a, b) => b.x - a.x);
      const cells = arr.map((a) =>
        process.env.XY ? "[" + a.x + "]" + logical(a.text) : logical(a.text)
      );
      const prefix = process.env.XY ? String(y).padStart(5) + " | " : "";
      console.log(prefix + cells.join(process.env.XY ? " " : "  ·  "));
    });
});
