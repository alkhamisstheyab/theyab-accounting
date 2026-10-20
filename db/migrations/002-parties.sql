-- ===================================================================
-- ٠٠٢ — الأطراف: سجلٌّ للمقاولين والموردين والعملاء
--
-- وكان الطرفُ لا وجودَ له إلا في عقده: جدولُ العقود يحمل اسمَ المقاول
-- وهاتفَه ومدنيَّه في كلِّ عقدٍ من عقوده. فمن له ثلاثةُ عقودٍ مكتوبٌ
-- ثلاثَ مرّات، ولو تغيّر هاتفُه صُحّح في ثلاثة مواضعَ أو بقي قديماً
-- في اثنين. ولم يكن له بابٌ يُعدَّل منه، ولا تخصّصٌ يُجمع به:
-- النجّارون وحدَهم، والحدّادون وحدَهم.
--
-- و«الأشخاص» في النظام أسماءٌ مجرّدةٌ لا بياناتَ لها — تصلح للاختيار
-- في قائمة، ولا تصلح سجلّاً.
--
-- فصار لهم سجلّ: بياناتُهم مرّةً واحدة، وتخصّصُهم، وحالُهم. والعقودُ
-- تُشير إليهم ولا تُعيد كتابتَهم.
-- ===================================================================

CREATE TABLE IF NOT EXISTS parties (
  id             text PRIMARY KEY,
  name           text NOT NULL DEFAULT '',
  -- عميل · مقاول · مورّد — وبه يُعزل سجلُّ العملاء عن سجلّ الموردين
  kind           text NOT NULL DEFAULT 'مقاول',
  -- النجّار والحدّاد والبنّاء والصحّي — وبه يُجمع أهلُ الصنعة الواحدة
  specialty      text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  civil_id       text NOT NULL DEFAULT '',
  address        text NOT NULL DEFAULT '',
  nationality    text NOT NULL DEFAULT '',
  -- السجلُّ التجاريُّ للشركات، والترخيصُ للأفراد
  license_number text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  -- ولا يُحذف من تعامَلَ معه: يُوقَف فلا يُقترح، ويبقى أثرُه في عقوده
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  data           jsonb NOT NULL DEFAULT '{}',
  rev            bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS parties_rev_idx ON parties (rev);
-- وبه تُقرأ صفحةُ الموردين: نوعُهم ثم تخصّصُهم
CREATE INDEX IF NOT EXISTS parties_kind_idx ON parties (kind, specialty);
