// 构建脚本 — 使用 esbuild 打包，兼容 bun 和 npm 环境
import { build } from "esbuild"
import { writeFileSync, readFileSync, chmodSync } from "fs"

// 构建插件主体
await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  external: ["@opencode-ai/plugin"],
})

// 构建 CLI 工具
await build({
  entryPoints: ["src/setup.ts"],
  outfile: "dist/setup.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  banner: { js: "#!/usr/bin/env node" },
})

// 设置可执行权限
chmodSync("dist/setup.js", 0o755)

console.log("✅ 构建完成 → dist/index.js, dist/setup.js")
