import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    مجلّد البناء يُؤخذ من البيئة إن وُجد.

    فيُبنى الفحص في مجلّدٍ غير الذي يعمل عليه النظام، فلا يُقطع على
    أحدٍ عملُه أثناء الفحص. وفي غير الفحص يبقى .next كما هو.
  */
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
