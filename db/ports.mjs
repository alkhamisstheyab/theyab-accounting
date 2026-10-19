/**
 * استبراءُ الطريق قبل المسير.
 *
 * الفحوصُ التي تُشغل خادماً تأخذ منفذين بأرقامٍ ثابتة: واحداً للقاعدة
 * وآخر للويب. وإن أخفق فحصٌ أو قُطع قبل تمامه بقي خادمُه قائماً على
 * منفذه — فقتلُ الغلاف (npx.cmd) على ويندوز لا يقتل الحفيدَ الذي
 * يسمع فعلاً.
 *
 * فيأتي الفحصُ التالي فلا يجد منفذه، فيموت خادمُه الجديد بـEADDRINUSE،
 * ثم يسأل المسبارُ من يُجيب على ذلك المنفذ — فيُجيبه الخادمُ القديم،
 * وقاعدتُه ميتةٌ منذ ساعات. فإمّا عُلّق الطلبُ إلى غير نهاية — وقد
 * عُلّق فحصٌ ساعتين على خادمٍ عمرُه ساعتان — وإمّا، وهو الأخطر، رجع
 * الفحصُ **أخضرَ على بناءٍ ليس المفحوص**.
 *
 * فلا يُمشى في طريقٍ فيه غيرُك: يُتحقّق أن المنافذ خالية، وإلا قيل
 * لصاحبه ما يَقتل قبل أن يُعيد.
 */
import net from "net";
import { execFileSync } from "child_process";

const free = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });

/**
 * يتحقّق أن المنافذ خالية، وإلا أخرج بالرمز ١.
 *
 * @param {Array<[number, string]>} wanted — المنفذ وما هو
 */
export async function requireFreePorts(wanted) {
  const taken = [];
  for (const [port, what] of wanted) if (!(await free(port))) taken.push([port, what]);
  if (taken.length === 0) return;

  console.error("");
  for (const [port, what] of taken) {
    console.error(`المنفذ ${port} مشغول (${what}) — فحصٌ سابقٌ لم يُطفأ.`);
  }
  console.error("");
  console.error("ولا يُفحص على منفذٍ فيه غيرُك: قد يُجيب خادمٌ قديمٌ ببناءٍ قديم.");
  console.error("اعرف من يسمع ثم اقتله:");
  for (const [port] of taken) {
    console.error(`  netstat -ano | findstr :${port}`);
  }
  console.error("  taskkill /F /PID <الرقم> /T");
  process.exit(1);
}

/**
 * يقتل الشجرة لا الغلافَ وحده.
 *
 * الخادمُ يُشغَّل على ويندوز بـ`npx.cmd` في غلافٍ (shell: true)، فالابنُ
 * الذي يملكه `spawn` هو cmd.exe، والذي يسمع على المنفذ حفيدُه. و`kill`
 * يقتل الابنَ فيبقى الحفيدُ قائماً بلا أب — فيحتلّ المنفذ إلى أن
 * يُقتل بيد. ووقع في كلِّ تشغيلةٍ لا في بعضها: ثلاثةُ أيتامٍ وُجدوا
 * في جلسةٍ واحدة، وعُلّق فحصٌ ساعتين على واحدٍ منهم.
 */
export function killTree(child) {
  if (!child || child.pid == null || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
        stdio: "ignore",
      });
      return;
    } catch {
      /* مات قبل أن يُقتل — ويُجرَّب الطريقُ المعتاد */
    }
  }
  try {
    child.kill();
  } catch {
    /* ذهب */
  }
}
