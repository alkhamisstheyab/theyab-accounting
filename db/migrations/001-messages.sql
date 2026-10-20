-- ===================================================================
-- ٠٠١ — الرسائل: طلبُ عملٍ يُوجَّه إلى موظّفٍ بعينه
--
-- أُضيف لأنّ التنبيهات كلَّها كانت مشتقّةً من الدفاتر: «حركةٌ تنتظر
-- اعتماداً»، «مضى على النسخة كذا». ولم يكن لصاحب الشركة بابٌ يقول به
-- لموظّفٍ بعينه: «افعل هذا». فكان يُقال بالهاتف فيُنسى، ولا يبقى منه
-- أثرٌ يُراجع.
--
-- ولا يُحذف من هذا الجدول شيءٌ عند الإنجاز: تُختم الرسالةُ بحالتها
-- ويبقى أثرُها — فمن أنجز يُعرف أنه أنجز ومتى، ومن تُرك طلبُه شهراً
-- يُعرف ذلك أيضاً.
-- ===================================================================

CREATE TABLE IF NOT EXISTS messages (
  id          text PRIMARY KEY,
  -- من أرسل، بالاسم كما في سجل التدقيق — فالحسابُ قد يُحذف والأثرُ يبقى
  from_name   text NOT NULL DEFAULT '',
  -- إلى من: معرّفُ المستخدم واسمُه معاً، فلا يُفقد المرسَلُ إليه بحذف حسابه
  to_user     text NOT NULL DEFAULT '',
  to_name     text NOT NULL DEFAULT '',
  body        text NOT NULL DEFAULT '',
  -- الشاشةُ التي يُنجَز فيها الطلب — يُنقل إليها بضغطة
  page        text NOT NULL DEFAULT '',
  -- ما يُشار إليه: رقم قيدٍ أو عقدٍ أو مشروع
  about       text NOT NULL DEFAULT '',
  -- جديدة · قُرئت · أُنجزت
  state       text NOT NULL DEFAULT 'جديدة',
  read_at     timestamptz,
  done_at     timestamptz,
  -- ملاحظةُ المنجِز: «أُنجز» بلا بيانٍ لا يُراجَع
  done_note   text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  data        jsonb NOT NULL DEFAULT '{}',
  rev         bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS messages_rev_idx ON messages (rev);
-- وبه يُقرأ بريدُ الموظّف عند ولوجه: ما لم يُنجَز أوّلاً
CREATE INDEX IF NOT EXISTS messages_to_idx ON messages (to_user, state);
