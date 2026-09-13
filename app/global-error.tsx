"use client";

// حدود الأخطاء يجب أن تكون Client Components.
// هذا الملف يستبدل التخطيط الجذري عند وقوع خطأ فيه، ولذلك يعرّف
// وسمَي html و body بنفسه ولا تصله أنماط globals.css.

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f1f5f9",
          color: "#0f172a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            padding: "2rem",
            borderRadius: "1rem",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.1)",
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.5rem" }}>حدث خطأ غير متوقع</h2>
          <p style={{ color: "#64748b", lineHeight: 1.7 }}>
            بياناتك المحفوظة في هذا المتصفح لم تتأثر. جرّب إعادة المحاولة، وإن
            تكرر الخطأ فنزّل نسخة احتياطية من صفحة الإعدادات.
          </p>
          {error.digest && (
            <p style={{ color: "#94a3b8", fontSize: ".75rem" }}>
              رمز الخطأ: {error.digest}
            </p>
          )}
          <button
            onClick={() => retry()}
            style={{
              marginTop: ".5rem",
              padding: ".75rem 1.5rem",
              borderRadius: ".5rem",
              border: 0,
              background: "#0f172a",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      </body>
    </html>
  );
}
