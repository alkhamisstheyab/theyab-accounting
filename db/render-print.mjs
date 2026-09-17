/**
 * يطبع أوراق النظام كما يطبعها المتصفّح فعلاً — لا كما تبدو على الشاشة.
 *
 *   node db/render-print.mjs <نسخة.json> <مجلّد الإخراج>
 *
 * الشكوى كانت: «الورقة على الشاشة كما صُمّمت، وعند أمر الطباعة تخرج
 * بشكلٍ وألوانٍ أخرى». وذلك لا يُرى بقراءة الشيفرة ولا بصورة الشاشة:
 * المتصفّح عند الطباعة يطبّق قواعد @media print، ويحذف ألوان الخلفية ما
 * لم يُؤمر بإبقائها. فيُشغَّل Chrome نفسه، وتُفتح الأوراق من الشاشات كما
 * يفتحها صاحبها، وتُطبع إلى PDF — وخيار «رسوم الخلفية» مطفأ، وهو ما عليه
 * Chrome حين يضغط المستخدم «طباعة».
 *
 * ولا يمسّ قاعدة الشركة: المتصفّح هنا فارغ إلا من النسخة، والمزامنة مطفأة،
 * ورابط القاعدة يُستبدل برابطٍ ميت.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const BACKUP = process.argv[2];
const OUT = process.argv[3];
if (!BACKUP || !OUT) {
  console.error("الاستعمال: node db/render-print.mjs <نسخة.json> <مجلّد الإخراج>");
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const PORT = 3214;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

/* ---- البيانات: كما يحفظها التطبيق، والمستخدمون فارغون فلا شاشة دخول ---- */
const parsed = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
const data = parsed.data ?? parsed;
const KEYS = {
  movements: "movements",
  projects: "projects",
  contractors: "contractors",
  openingBalances: "openingBalances",
  materials: "materials",
  materialReceipts: "materialReceipts",
  company: "company",
  users: "users",
  audit: "auditLog",
  yearLocks: "yearLocks",
  chart: "chartOfAccounts",
  items: "itemMap",
  payments: "paymentMap",
  people: "people",
  employees: "employees",
  attendance: "attendance",
  payrollRuns: "payrollRuns",
  payrollSettings: "payrollSettings",
  workItems: "workItems",
  quotations: "quotations",
  invoices: "invoices",
};
const seed = {};
for (const [field, key] of Object.entries(KEYS)) {
  if (data[field] === undefined) continue;
  seed[key] = JSON.stringify(field === "users" ? [] : data[field]);
}

/* ---- الخادم ---- */
const env = {
  ...process.env,
  /* رابطٌ ميت: لا تُطلب القاعدة أصلاً والمزامنة مطفأة، وهذا احتياطٌ فوق ذلك */
  DATABASE_URL: "postgres://nobody:nothing@127.0.0.1:1/none",
  NEXT_DIST_DIR: ".next-render",
  PORT: String(PORT),
};
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const shell = process.platform === "win32";

if (!process.argv.includes("--no-build")) {
  console.log("يبني النظام…");
  execFileSync(npx, ["next", "build"], {
    cwd: ROOT,
    env,
    stdio: ["ignore", "ignore", "inherit"],
    shell,
  });
}

const web = spawn(npx, ["next", "start", "--port", String(PORT)], {
  cwd: ROOT,
  env,
  stdio: ["ignore", "pipe", "pipe"],
  shell,
});
let log = "";
web.stdout.on("data", (d) => (log += d));
web.stderr.on("data", (d) => (log += d));

/*
  على ويندوز يُشغَّل الخادم عبر نافذة أوامر، فـ web.kill() يُغلق النافذة ويترك
  الخادم حيّاً ممسكاً بالمنفذ. فتسقط الجولة التالية: خادمها لا يجد المنفذ،
  ويجيب الخادمُ القديم وقد استُبدلت ملفاته — فتتعلّق الصفحة. فتُقتل الشجرة كلها.
*/
function stopServer() {
  if (process.platform === "win32" && web.pid) {
    try {
      execFileSync("taskkill", ["/PID", String(web.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      /* انتهى من قبل */
    }
  } else {
    web.kill();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let up = false;
for (let i = 0; i < 60 && !up; i++) {
  await sleep(1500);
  try {
    up = (await fetch(BASE)).status < 500;
  } catch {
    up = false;
  }
}
if (!up) {
  console.error("لم يبدأ الخادم:\n" + log.slice(-2000));
  stopServer();
  process.exit(1);
}

/* ---- المتصفّح ---- */
const { default: puppeteer } = await import("puppeteer-core");
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--lang=ar"],
});

const results = [];

async function fresh() {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1800 });
  page.on("dialog", (d) => d.accept());
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.evaluate((s) => {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto(BASE, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => document.body.innerText.includes("الرئيسية"), {
    timeout: 30000,
  });
  return page;
}

/**
 * يضغط زرّاً بنصّه — مطابقاً تماماً، وإلا زرّاً يبدأ به.
 *
 * فأزرار القائمة تحمل شارة عددٍ ملصقة بالاسم («المقاولون38»)، فلا يطابق
 * نصُّها الاسمَ تماماً.
 */
async function click(page, text) {
  const ok = await page.evaluate((t) => {
    const all = [...document.querySelectorAll("button")];
    const norm = (x) => x.textContent.replace(/\s+/g, " ").trim();
    const b =
      all.find((x) => norm(x) === t) ??
      all.find((x) => norm(x).startsWith(t) && /^[\d\s]*$/.test(norm(x).slice(t.length)));
    if (!b) return false;
    b.click();
    return true;
  }, text);
  if (!ok) throw new Error(`لم يُعثر على زرّ «${text}»`);
  await sleep(700);
}

async function capture(page, name) {
  /* صورة الشاشة — التصميم كما يُرى */
  const sheet = await page.$(".voucher-body, .contract-sheet, .print-sheet");
  if (sheet) {
    await sheet.screenshot({ path: path.join(OUT, `${name}-screen.png`) });
  } else {
    await page.screenshot({ path: path.join(OUT, `${name}-screen.png`), fullPage: true });
  }
  /* الطباعة — كما يطبعها Chrome: رسوم الخلفية مطفأة */
  await page.pdf({
    path: path.join(OUT, `${name}-print.pdf`),
    format: "A4",
    printBackground: false,
    preferCSSPageSize: true,
  });
  results.push(name);
  console.log(`  ✓ ${name}`);
}

try {
  console.log("");

  /* ---- الفاتورة: القالب الموحّد ---- */
  {
    const page = await fresh();
    await click(page, "الفواتير");
    await click(page, "🖨");
    await capture(page, "invoice");
    await page.close();
  }

  /* ---- عرض السعر ---- */
  {
    const page = await fresh();
    await click(page, "عروض الأسعار");
    await click(page, "فتح");
    await click(page, "🖨 عرض السعر");
    await capture(page, "quotation");
    await page.close();
  }

  /* ---- العقد: يُطبع ليُتحقَّق أنه لم يتغيّر ---- */
  {
    const page = await fresh();
    await click(page, "المقاولون");
    await click(page, "🖨 طباعة");
    await capture(page, "contract");
    await page.close();
  }

  /* ---- سند صرف: القالب الموحّد نفسه ---- */
  {
    const page = await fresh();
    await click(page, "جدول الحركات");
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) => x.textContent.trim() === "🖨 سند" && !x.disabled
      );
      if (!b) return false;
      b.click();
      return true;
    });
    if (!opened) throw new Error("لا سند قابل للطباعة");
    await sleep(700);
    await capture(page, "voucher");
    await page.close();
  }
} catch (error) {
  console.error("\n" + String(error?.stack ?? error));
} finally {
  await browser.close();
  stopServer();
}

console.log(`\nأُخرج ${results.length} ورقة إلى ${OUT}`);
process.exit(results.length > 0 ? 0 : 1);
