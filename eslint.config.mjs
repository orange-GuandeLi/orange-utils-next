import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // tiptap CLI 生成的代码
    "src/components/tiptap-*/**",
    "src/components/tiptap-templates/**",
    "src/hooks/**",
    "src/lib/**",
    "src/scss.d.ts",
    "src/styles/**",
    "src/tools/html-selector/hooks/**",
  ]),
]);

export default eslintConfig;
