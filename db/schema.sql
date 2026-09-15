-- ===================================================================
-- قاعدة بيانات النظام المحاسبي — PostgreSQL
--
-- نسخة لكل شركة: قاعدة مستقلة تماماً، فلا حاجة لعمود «الشركة» في كل
-- جدول ولا لعزل برمجي بين المنشآت. إضافة شركة أخرى = قاعدة أخرى.
--
-- مبدأ التطبيع المتّبع:
--   يُطبَّع ما يُستعلَم عنه مستقلاً — الحركات والمشاريع والعقود والبنود
--   والفواتير والمستخدمون وسجل التدقيق.
--   ويبقى jsonb ما لا يُقرأ إلا مع أبيه — دفعات العقد، وسطور العرض،
--   وسطور المسيّر، وبنود العقد القانونية. تطبيعها يضاعف الجداول بلا
--   استعلام واحد يستفيد منه.
--
-- المبالغ NUMERIC(14,3): الدينار الكويتي ثلاث خانات، والعائم يخطئ.
-- ===================================================================

-- ---------- تتبّع التغيير ----------

/*
  تسلسلٌ واحد لكل الجداول: كل كتابة تأخذ رقماً أكبر مما قبله. فيسأل
  المتصفّح «ما تغيّر بعد الرقم كذا؟» فيصله ما كتبه غيره وحده — لا
  الحالة كلها في كل مرة، ولا شيء يفوته.

  ولو كان لكل جدول تسلسله لما أمكن ترتيب تغييرين من جدولين، ولظهر
  اعتماد دفعةٍ قبل الحركة التي اعتُمدت عليها.
*/
CREATE SEQUENCE change_seq;

/*
  الصفّ المحذوف لا يُستعلم عنه، فيبقى له شاهد. وبغيره لا يعرف
  المتصفّح أن حركةً حُذفت، فتبقى على شاشته بعد أن زالت من القاعدة.
*/
CREATE TABLE deletions (
  collection text   NOT NULL,
  row_id     text   NOT NULL,
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text   NOT NULL DEFAULT '',
  PRIMARY KEY (collection, row_id)
);

CREATE INDEX deletions_rev_idx ON deletions (rev);

-- ---------- الشركة والإعدادات ----------

CREATE TABLE company (
  id                  smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name                text NOT NULL DEFAULT '',
  name_en             text NOT NULL DEFAULT '',
  logo                text NOT NULL DEFAULT '',
  address             text NOT NULL DEFAULT '',
  phone               text NOT NULL DEFAULT '',
  email               text NOT NULL DEFAULT '',
  cr_number           text NOT NULL DEFAULT '',
  approval_threshold  numeric(14,3) NOT NULL DEFAULT 0,
  backup_every_days   integer NOT NULL DEFAULT 10,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------- المستخدمون ----------

CREATE TABLE users (
  id              uuid PRIMARY KEY,
  name            text NOT NULL,
  job_title       text NOT NULL DEFAULT '',
  role            text NOT NULL,
  permissions     text[] NOT NULL DEFAULT '{}',
  -- تجزئة كلمة المرور بـ bcrypt — لا يصل النصّ الصريح إلى القاعدة أبداً
  password_hash   text NOT NULL DEFAULT '',
  must_change_pin boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  last_seen_at    timestamptz,
  -- إيقاف مؤقت بعد محاولات خاطئة: النظام على الإنترنت يُجرَّب عليه آلياً
  failed_attempts smallint NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX users_rev_idx ON users (rev);

CREATE UNIQUE INDEX users_name_key ON users (name);

CREATE TABLE sessions (
  token       text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  user_agent  text NOT NULL DEFAULT ''
);

CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

-- ---------- البيانات الأساسية ----------

CREATE TABLE accounts (
  code       text PRIMARY KEY,
  name       text NOT NULL,
  parent     text NOT NULL DEFAULT '',
  type       text NOT NULL,
  nature     text NOT NULL,
  level      smallint NOT NULL DEFAULT 3,
  statement  text NOT NULL DEFAULT '',
  active     boolean NOT NULL DEFAULT true,
  postable   boolean NOT NULL DEFAULT true,
  -- ترتيبها كما أدخله المستخدم. والترتيب بيانات: من رتّب طرق الدفع
  -- بالأكثر استعمالاً أولاً لا يُقبل أن تعود إليه مرتّبةً بالحروف.
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE items (
  code     text PRIMARY KEY,
  name     text NOT NULL,
  account  text NOT NULL DEFAULT '',
  -- ترتيبها كما أدخله المستخدم. والترتيب بيانات: من رتّب طرق الدفع
  -- بالأكثر استعمالاً أولاً لا يُقبل أن تعود إليه مرتّبةً بالحروف.
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE payment_methods (
  label    text PRIMARY KEY,
  account  text NOT NULL DEFAULT '',
  -- ترتيبها كما أدخله المستخدم. والترتيب بيانات: من رتّب طرق الدفع
  -- بالأكثر استعمالاً أولاً لا يُقبل أن تعود إليه مرتّبةً بالحروف.
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE people (
  name text PRIMARY KEY,
  -- ترتيبها كما أدخله المستخدم. والترتيب بيانات: من رتّب طرق الدفع
  -- بالأكثر استعمالاً أولاً لا يُقبل أن تعود إليه مرتّبةً بالحروف.
  sort_order smallint NOT NULL DEFAULT 0
);

-- ---------- المشاريع ----------

CREATE TABLE projects (
  id          uuid PRIMARY KEY,
  name        text NOT NULL,
  budget      numeric(14,3) NOT NULL DEFAULT 0,
  start_date  date,
  status      text NOT NULL DEFAULT 'نشط',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX projects_rev_idx ON projects (rev);

CREATE UNIQUE INDEX projects_name_key ON projects (name);

-- ---------- العقود ----------

CREATE TABLE contracts (
  id                     uuid PRIMARY KEY,
  contract_number        text NOT NULL,
  counterparty_type      text NOT NULL DEFAULT 'مقاول',
  document_type          text NOT NULL DEFAULT 'عقد',
  parent_contract_number text NOT NULL DEFAULT '',
  name                   text NOT NULL,
  specialty              text NOT NULL DEFAULT '',
  phone                  text NOT NULL DEFAULT '',
  project                text NOT NULL DEFAULT '',
  contract_type          text NOT NULL DEFAULT '',
  work_type              text NOT NULL DEFAULT '',
  contract_value         numeric(14,3) NOT NULL DEFAULT 0,
  contract_date          date,
  civil_id               text NOT NULL DEFAULT '',
  passport_number        text NOT NULL DEFAULT '',
  nationality            text NOT NULL DEFAULT '',
  address                text NOT NULL DEFAULT '',
  plot                   text NOT NULL DEFAULT '',
  block                  text NOT NULL DEFAULT '',
  area                   text NOT NULL DEFAULT '',
  license_number         text NOT NULL DEFAULT '',
  building_description   text NOT NULL DEFAULT '',
  duration_days          integer NOT NULL DEFAULT 0,
  -- تاريخ الانتهاء المتوقَّع، يُكتب بيد من يعرف الموقع ويعلو على الحساب
  expected_end_date      date,
  delay_penalty_per_day  numeric(14,3) NOT NULL DEFAULT 0,
  max_penalty_percent    numeric(6,2) NOT NULL DEFAULT 0,
  termination_after_days integer NOT NULL DEFAULT 0,
  warranty_years         integer NOT NULL DEFAULT 0,
  preamble               text NOT NULL DEFAULT '',
  notes                  text NOT NULL DEFAULT '',
  -- تُقرأ وتُكتب مع العقد دائماً، ولا يُستعلم عنها وحدها
  clauses                jsonb NOT NULL DEFAULT '[]',
  obligations            jsonb NOT NULL DEFAULT '[]',
  installments           jsonb NOT NULL DEFAULT '[]',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX contracts_rev_idx ON contracts (rev);

CREATE UNIQUE INDEX contracts_number_key ON contracts (contract_number);
CREATE INDEX contracts_project_idx ON contracts (project);

-- ---------- الحركات ----------

CREATE TABLE movements (
  id                 uuid PRIMARY KEY,
  entry_no           integer NOT NULL,
  fiscal_year        smallint NOT NULL,
  entry_date         date,
  movement_type      text NOT NULL DEFAULT '',
  description        text NOT NULL DEFAULT '',
  item_code          text NOT NULL DEFAULT '',
  item_name          text NOT NULL DEFAULT '',
  debit_code         text NOT NULL DEFAULT '',
  credit_code        text NOT NULL DEFAULT '',
  amount             numeric(14,3) NOT NULL DEFAULT 0,
  project            text NOT NULL DEFAULT '',
  person             text NOT NULL DEFAULT '',
  payment_method     text NOT NULL DEFAULT '',
  party              text NOT NULL DEFAULT '',
  contract_number    text NOT NULL DEFAULT '',
  installment_number smallint,
  source             text NOT NULL DEFAULT 'app',
  -- دورة الاعتماد: غير المعتمدة محفوظة ولا تدخل أي حساب
  approval           text NOT NULL DEFAULT 'معتمدة',
  approved_by        text NOT NULL DEFAULT '',
  approved_at        timestamptz,
  approval_note      text NOT NULL DEFAULT '',
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT movements_approval_check
    CHECK (approval IN ('بانتظار الاعتماد', 'معتمدة', 'مرفوضة')),
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX movements_rev_idx ON movements (rev);

-- رقم القيد فريد داخل سنته لا في الجدول كله
CREATE UNIQUE INDEX movements_entry_key ON movements (fiscal_year, entry_no);

-- الفهارس مبنية على ما تستعلم عنه الشاشات فعلاً
CREATE INDEX movements_year_approval_idx ON movements (fiscal_year, approval);
CREATE INDEX movements_date_idx          ON movements (entry_date);
CREATE INDEX movements_project_idx       ON movements (project);
CREATE INDEX movements_debit_idx         ON movements (debit_code);
CREATE INDEX movements_credit_idx        ON movements (credit_code);
CREATE INDEX movements_contract_idx      ON movements (contract_number)
  WHERE contract_number <> '';

-- ---------- الأرصدة الافتتاحية ----------

CREATE TABLE opening_balances (
  fiscal_year  smallint NOT NULL,
  account_code text NOT NULL,
  debit        numeric(14,3) NOT NULL DEFAULT 0,
  credit       numeric(14,3) NOT NULL DEFAULT 0,
  PRIMARY KEY (fiscal_year, account_code)
);

CREATE TABLE year_locks (
  fiscal_year smallint PRIMARY KEY,
  closed_at   timestamptz NOT NULL,
  closed_by   text NOT NULL DEFAULT '',
  note        text NOT NULL DEFAULT ''
);

-- ---------- المواد ----------

CREATE TABLE materials (
  id              uuid PRIMARY KEY,
  name            text NOT NULL,
  unit            text NOT NULL DEFAULT '',
  indicative_price numeric(14,3) NOT NULL DEFAULT 0,
  notes           text NOT NULL DEFAULT '',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX materials_rev_idx ON materials (rev);

CREATE TABLE material_receipts (
  id           uuid PRIMARY KEY,
  receipt_date date,
  project      text NOT NULL DEFAULT '',
  material_id  uuid,
  material     text NOT NULL DEFAULT '',
  quantity     numeric(14,3) NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT '',
  unit_price   numeric(14,3),
  supplier     text NOT NULL DEFAULT '',
  received_by  text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX material_receipts_rev_idx ON material_receipts (rev);

CREATE INDEX material_receipts_project_idx ON material_receipts (project);

-- ---------- الرواتب ----------

CREATE TABLE employees (
  id      uuid PRIMARY KEY,
  name    text NOT NULL,
  -- بقية الحقول كثيرة ومتغيّرة مع القانون، وتُقرأ مع الموظف دائماً
  data    jsonb NOT NULL DEFAULT '{}',
  active  boolean NOT NULL DEFAULT true,
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX employees_rev_idx ON employees (rev);

CREATE TABLE attendance (
  -- مفتاحه مشتقٌّ من الموظف واليوم، فيبقى الجدول كبقيّته: معرّفٌ واحد
  -- تُكتب عليه الصفوف وتُحذف، واليومُ الواحد لا يتكرّر للموظف الواحد
  id          uuid PRIMARY KEY,
  employee_id uuid NOT NULL,
  day         date NOT NULL,
  status      text NOT NULL DEFAULT '',
  hours       numeric(6,2) NOT NULL DEFAULT 0,
  overtime    numeric(6,2) NOT NULL DEFAULT 0,
  note        text NOT NULL DEFAULT '',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX attendance_rev_idx ON attendance (rev);

CREATE UNIQUE INDEX attendance_day_key ON attendance (employee_id, day);

CREATE TABLE payroll_runs (
  id           uuid PRIMARY KEY,
  month        text NOT NULL,
  fiscal_year  smallint NOT NULL,
  status       text NOT NULL DEFAULT 'مسودة',
  created_at   timestamptz,
  created_by   text NOT NULL DEFAULT '',
  approved_at  timestamptz,
  approved_by  text NOT NULL DEFAULT '',
  posted_movement_ids uuid[] NOT NULL DEFAULT '{}',
  lines        jsonb NOT NULL DEFAULT '[]',
  deductions   jsonb NOT NULL DEFAULT '{}',
  note         text NOT NULL DEFAULT '',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX payroll_runs_rev_idx ON payroll_runs (rev);

CREATE UNIQUE INDEX payroll_runs_month_key ON payroll_runs (month);

CREATE TABLE payroll_settings (
  id    smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data  jsonb NOT NULL DEFAULT '{}'
);

-- ---------- عروض الأسعار ----------

CREATE TABLE work_items (
  id              uuid PRIMARY KEY,
  stage           text NOT NULL,
  section         text NOT NULL DEFAULT '',
  name            text NOT NULL DEFAULT '',
  detail          text NOT NULL DEFAULT '',
  description     text NOT NULL DEFAULT '',
  unit            text NOT NULL DEFAULT '',
  quantity        numeric(14,3) NOT NULL DEFAULT 0,
  cost            numeric(14,3) NOT NULL DEFAULT 0,
  material_cost   numeric(14,3) NOT NULL DEFAULT 0,
  cost_updated_at timestamptz,
  cost_updated_by text NOT NULL DEFAULT '',
  price           numeric(14,3) NOT NULL DEFAULT 0,
  material_price  numeric(14,3) NOT NULL DEFAULT 0,
  essential       boolean NOT NULL DEFAULT false,
  active          boolean NOT NULL DEFAULT true,
  notes           text NOT NULL DEFAULT '',
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX work_items_rev_idx ON work_items (rev);

CREATE INDEX work_items_stage_idx ON work_items (stage);

CREATE TABLE quotations (
  id                   uuid PRIMARY KEY,
  number               text NOT NULL,
  quote_date           date,
  status               text NOT NULL DEFAULT 'مسودة',
  client_name          text NOT NULL DEFAULT '',
  client_phone         text NOT NULL DEFAULT '',
  client_civil_id      text NOT NULL DEFAULT '',
  client_address       text NOT NULL DEFAULT '',
  area                 text NOT NULL DEFAULT '',
  block                text NOT NULL DEFAULT '',
  plot                 text NOT NULL DEFAULT '',
  license_number       text NOT NULL DEFAULT '',
  building_description text NOT NULL DEFAULT '',
  built_area           numeric(14,3) NOT NULL DEFAULT 0,
  scope                text NOT NULL DEFAULT '',
  pricing_mode         text NOT NULL DEFAULT 'مصنعية ومواد',
  margin_percent       numeric(6,2) NOT NULL DEFAULT 0,
  duration_days        integer NOT NULL DEFAULT 0,
  validity_days        integer NOT NULL DEFAULT 0,
  notes                text NOT NULL DEFAULT '',
  contract_number      text NOT NULL DEFAULT '',
  -- سطور العرض لقطة مجمّدة وقت إصداره، لا تُقرأ إلا معه
  lines                jsonb NOT NULL DEFAULT '[]',
  created_by           text NOT NULL DEFAULT '',
  created_at           timestamptz,
  -- متى عُدّل العرض في التطبيق. وهو غير updated_at أدناه: ذاك متى
  -- كُتب الصفّ في القاعدة، وقد يُكتب بلا تعديلٍ في العرض نفسه.
  edited_at            timestamptz,
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX quotations_rev_idx ON quotations (rev);

CREATE UNIQUE INDEX quotations_number_key ON quotations (number);

-- ---------- الفواتير ----------

CREATE TABLE invoices (
  id                 uuid PRIMARY KEY,
  number             text NOT NULL,
  invoice_date       date,
  client_name        text NOT NULL DEFAULT '',
  client_civil_id    text NOT NULL DEFAULT '',
  client_phone       text NOT NULL DEFAULT '',
  project_location   text NOT NULL DEFAULT '',
  project            text NOT NULL DEFAULT '',
  contract_title     text NOT NULL DEFAULT '',
  installment_label  text NOT NULL DEFAULT '',
  contract_number    text NOT NULL DEFAULT '',
  installment_number smallint,
  payment_method     text NOT NULL DEFAULT '',
  lines              jsonb NOT NULL DEFAULT '[]',
  notes              text NOT NULL DEFAULT '',
  created_by         text NOT NULL DEFAULT '',
  created_at         timestamptz,
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX invoices_rev_idx ON invoices (rev);

CREATE UNIQUE INDEX invoices_number_key ON invoices (number);

-- ---------- سجل التدقيق ----------

CREATE TABLE audit_log (
  id         uuid PRIMARY KEY,
  at         timestamptz NOT NULL,
  actor      text NOT NULL DEFAULT '',
  action     text NOT NULL DEFAULT '',
  entity     text NOT NULL DEFAULT '',
  summary    text NOT NULL DEFAULT '',
  before_val text,
  after_val  text,
  -- كائن التطبيق كاملاً؛ الأعمدة أعلاه نسخة منه للاستعلام والقيود
  data jsonb NOT NULL DEFAULT '{}',
  -- رقم التغيير ومَن كتبه: بهما يُعرف ما استجدّ وعلى يد من
  rev        bigint NOT NULL DEFAULT nextval('change_seq'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT ''
);

CREATE INDEX audit_log_rev_idx ON audit_log (rev);

CREATE INDEX audit_at_idx ON audit_log (at DESC);
