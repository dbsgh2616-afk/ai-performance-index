import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PDF 증적자료에 넣는 한글 글꼴 파일이 배포(Vercel) 때 빠지지 않게 함께 포함한다. (lib/evidence/pdf.tsx)
  outputFileTracingIncludes: {
    "/api/export/pdf": [
      "./node_modules/@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf",
      "./node_modules/@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf",
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
