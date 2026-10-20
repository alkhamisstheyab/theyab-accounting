-- ===================================================================
-- ٠٠٣ — تقاريرُ الاجتماعات: ما قيل بين الشركة وعميلها، موثَّقاً
--
-- وكان ما يُتَّفق عليه في اجتماعٍ أو مكالمةٍ يبقى في الذاكرة: فيُنسى،
-- أو يُختلف فيه بعد شهرين — «قلتَ كذا» و«لم أقل». ولم يكن في النظام
-- موضعٌ يُكتب فيه: من حضر، وما قيل، وما التُزم به.
--
-- والصورُ لا تُحفظ هنا: مواضعُها مخزنُ Blob، ويُحفظ في الصفّ مسارُها
-- وحدَه. ولو حُفظت في القاعدة لتضخّمت النسخةُ الاحتياطية — وهي اليومَ
-- ٣٫٨٥ ميغا، وحدُّ الردّ عند الناشر ٤٫٥ — فتُخفق النسخةُ صامتةً يومَ
-- تُحتاج، وتلك خسارةُ الدفاتر كلِّها لأجل صورة.
-- ===================================================================

CREATE TABLE IF NOT EXISTS minutes (
  id          text PRIMARY KEY,
  -- yyyy-mm-dd — يومُ الاجتماع لا يومُ كتابته
  date        text NOT NULL DEFAULT '',
  -- أسبوعيّ · شهريّ · طارئ — وبه تُجمع
  period      text NOT NULL DEFAULT 'طارئ',
  -- المشروعُ أو العميل، وبه يُبحث
  project     text NOT NULL DEFAULT '',
  -- اجتماع · مكالمة · زيارة موقع · مراسلة
  kind        text NOT NULL DEFAULT 'اجتماع',
  title       text NOT NULL DEFAULT '',
  -- من حضر، أسماءً مفصولةً — ولا يُكتفى بـ«الطرفان»
  attendees   text NOT NULL DEFAULT '',
  -- ما قيل
  body        text NOT NULL DEFAULT '',
  -- ما التُزم به: قراراتٌ وأعمالٌ، سطراً سطراً في data
  decisions   jsonb NOT NULL DEFAULT '[]',
  -- مساراتُ الصور في المخزن — لا الصورُ أنفسها
  photos      jsonb NOT NULL DEFAULT '[]',
  created_by  text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  data        jsonb NOT NULL DEFAULT '{}',
  rev         bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS minutes_rev_idx ON minutes (rev);
-- وبه تُقرأ تقاريرُ مشروعٍ بتواريخها
CREATE INDEX IF NOT EXISTS minutes_project_idx ON minutes (project, date DESC);
