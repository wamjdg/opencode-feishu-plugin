import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import * as readline from "readline"

const GLOBAL_DIR    = join(homedir(), ".config", "opencode")
const GLOBAL_CONFIG = join(GLOBAL_DIR, "feishu.json")
const OC_CONFIG     = join(GLOBAL_DIR, "opencode.json")

const RESET  = "\x1b[0m"
const BOLD   = "\x1b[1m"
const GREEN  = "\x1b[32m"
const YELLOW = "\x1b[33m"
const CYAN   = "\x1b[36m"
const DIM    = "\x1b[2m"

function print(msg: string) { process.stdout.write(msg + "\n") }
function success(msg: string) { print(`${GREEN}✅ ${msg}${RESET}`) }
function warn(msg: string)    { print(`${YELLOW}⚠️  ${msg}${RESET}`) }
function info(msg: string)    { print(`${CYAN}ℹ️  ${msg}${RESET}`) }
function title(msg: string)   { print(`\n${BOLD}${msg}${RESET}`) }
function dim(msg: string)     { print(`${DIM}${msg}${RESET}`) }

// ─── 交互式输入 ───────────────────────────────────────
function ask(rl: readline.Interface, question: string, defaultVal = ""): Promise<string> {
  return new Promise(resolve => {
    const hint = defaultVal ? ` ${DIM}[${defaultVal}]${RESET}` : ""
    rl.question(`${CYAN}?${RESET} ${question}${hint}: `, answer => {
      resolve(answer.trim() || defaultVal)
    })
  })
}

function askYN(rl: readline.Interface, question: string, defaultVal = false): Promise<boolean> {
  const hint = defaultVal ? "Y/n" : "y/N"
  return new Promise(resolve => {
    rl.question(`${CYAN}?${RESET} ${question} ${DIM}(${hint})${RESET}: `, answer => {
      const v = answer.trim().toLowerCase()
      if (!v) resolve(defaultVal)
      else resolve(v === "y" || v === "yes")
    })
  })
}

// ─── 读取已有配置（用于默认值）─────────────────────────
function loadExisting(): Partial<any> {
  try {
    if (existsSync(GLOBAL_CONFIG))
      return JSON.parse(readFileSync(GLOBAL_CONFIG, "utf-8"))
  } catch {}
  return {}
}

// ─── 注册插件到 opencode.json ──────────────────────────
function registerPlugin() {
  let oc: any = {}
  try {
    if (existsSync(OC_CONFIG)) oc = JSON.parse(readFileSync(OC_CONFIG, "utf-8"))
  } catch {}

  const plugins: string[] = oc.plugin ?? []
  if (!plugins.includes("opencode-feishu-plugin")) {
    plugins.push("opencode-feishu-plugin")
    oc.plugin = plugins
    writeFileSync(OC_CONFIG, JSON.stringify(oc, null, 2), "utf-8")
    success("插件已注册到 opencode.json")
  } else {
    info("插件已在 opencode.json 中注册，跳过")
  }
}

// ─── 主流程 ───────────────────────────────────────────
async function main() {
  print(`
${BOLD}╔══════════════════════════════════════╗
║   opencode-feishu-plugin 配置向导    ║
╚══════════════════════════════════════╝${RESET}`)

  const existing = loadExisting()
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

  // ── 凭证 ──
  title("第 1 步：填写飞书应用凭证")
  info("获取凭证：open.feishu.cn → 我的应用 → 选择应用 → 凭证与基础信息")
  const app_id     = await ask(rl, "App ID", existing.app_id ?? "")
  const app_secret = await ask(rl, "App Secret", existing.app_secret ?? "")

  // ── 默认推送目标（可选）──
  title("第 2 步：默认推送目标（可选）")
  dim("  用于 auto_push / push_on_complete / 手动工具推送功能")
  dim("  如需让 AI 主动给飞书发消息，填写目标群/私聊对应的 chat_id（oc_xxx格式）")
  const default_chat_id = await ask(rl, "默认推送 Chat ID（选填，可回车跳过）", existing.default_chat_id ?? "")

  // ── 行为配置 ──
  title("第 3 步：行为配置")
  const auto_push        = await askYN(rl, "AI 每次回复自动推送到飞书（需配置默认Chat ID）？", existing.auto_push ?? false)
  const push_on_complete = await askYN(rl, "任务完成时发飞书通知（需配置默认Chat ID）？",      existing.push_on_complete ?? true)
  const prefix           = await ask(rl, "消息前缀", existing.prefix ?? "🤖 OpenCode")

  rl.close()

  // ── 写入配置 ──
  title("第 4 步：保存配置")
  mkdirSync(GLOBAL_DIR, { recursive: true })

  const config: any = {
    app_id, app_secret,
    auto_push, push_on_complete, prefix
  }
  if (default_chat_id) config.default_chat_id = default_chat_id

  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2), "utf-8")
  success(`配置已保存到 ${GLOBAL_CONFIG}`)

  // ── 注册插件 ──
  registerPlugin()

  // ── 完成提示 ──
  print(`
${GREEN}${BOLD}🎉 配置完成！${RESET}

${BOLD}下一步：事件订阅配置 (必需)${RESET}
  由于本插件采用全新的WebSocket长连接架构实现双向通信：
  1. 打开飞书开发者后台 → 事件订阅
  2. 启用事件订阅，订阅方式选择：${DIM}使用长连接接收事件${RESET}
  3. 添加事件：${DIM}im.message.receive_v1${RESET}（接收消息）
  4. 重启 OpenCode，现在你可以在飞书机器人里向 OpenCode 发送消息控制 AI 啦！

${BOLD}命令参考：${RESET}
  ${DIM}opencode-feishu setup${RESET}   重新运行配置向导
  ${DIM}opencode-feishu show${RESET}    查看当前配置
  ${DIM}opencode-feishu test${RESET}    发送测试消息
`)
}

// ── 子命令处理 ──────────────────────────────────────────
const cmd = process.argv[2]

if (cmd === "show") {
  // 显示当前配置（隐藏敏感字段）
  title("当前配置")
  if (!existsSync(GLOBAL_CONFIG)) {
    warn("配置文件不存在，请先运行：opencode-feishu setup")
    process.exit(1)
  }
  const cfg = JSON.parse(readFileSync(GLOBAL_CONFIG, "utf-8"))
  if (cfg.app_secret) cfg.app_secret = cfg.app_secret.slice(0, 4) + "****"
  print(JSON.stringify(cfg, null, 2))

} else if (cmd === "test") {
  // 发送测试消息（需填 default_chat_id）
  title("发送测试消息")
  if (!existsSync(GLOBAL_CONFIG)) {
    warn("配置文件不存在，请先运行：opencode-feishu setup")
    process.exit(1)
  }
  const cfg = JSON.parse(readFileSync(GLOBAL_CONFIG, "utf-8"))
  if (!cfg.default_chat_id) {
    warn("未配置 default_chat_id，test 命令无法发送主动测试消息")
    process.exit(1)
  }
  const text = `${cfg.prefix ?? "🤖 OpenCode"}\n🧪 测试消息 — 配置验证成功！\n时间：${new Date().toLocaleString("zh-CN")}`
  
  import("@larksuiteoapi/node-sdk").then(async (lark) => {
    try {
      const client = new lark.Client({ appId: cfg.app_id, appSecret: cfg.app_secret })
      await client.im.v1.message.create({
        params: { receive_id_type: "chat_id" },
        data: { receive_id: cfg.default_chat_id, msg_type: "text", content: JSON.stringify({ text }) }
      })
      success("测试消息已发送，请检查飞书")
    } catch(e: any) {
      warn(`发送失败：${e.message}`)
    }
  }).catch((e) => {
    warn(`测试工具加载 SDK 失败: ${e.message}`)
  })

} else {
  // 默认：运行配置向导
  main().catch(e => { console.error(e); process.exit(1) })
}
