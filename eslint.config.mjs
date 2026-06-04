import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // tiptap 官方模板：未修改的第三方代码
    "src/components/tiptap-*/**",
    "src/components/tiptap-templates/**",
    "src/scss.d.ts",
    "src/styles/**",
  ]),
])

export default eslintConfig
