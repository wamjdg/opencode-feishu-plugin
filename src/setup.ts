
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

  // ── 飞书模式选择 ──
  title("第 1 步：选择接入模式")
  dim("  webhook  - 群机器人，配置最简单（推荐新手）")
  dim("  chat_id  - 自建应用，支持私聊和更多功能")
  const mode = await ask(rl, "选择模式 (webhook / chat_id)", existing.chat_id ? "chat_id" : "webhook")
  const useWebhook = mode !== "chat_id"

  // ── 凭证 ──
  title("第 2 步：填写飞书凭证")

  let app_id     = ""
  let app_secret = ""
  let webhook    = ""
  let chat_id    = ""

  if (useWebhook) {
    info("获取 Webhook：飞书群 → 设置 → 群机器人 → 添加自定义机器人 → 复制 Webhook 地址")
    webhook = await ask(rl, "Webhook 地址", existing.webhook ?? "")
    if (!webhook.startsWith("https://open.feishu.cn")) {
      warn("Webhook 地址格式看起来不对，请确认是否正确")
    }
    // webhook 模式下 app_id/secret 可选，用于后续高级功能
    info("还可以填写应用凭证（用于后续高级功能，可跳过）")
    app_id     = await ask(rl, "App ID（选填，可回车跳过）", existing.app_id ?? "")
    app_secret = app_id ? await ask(rl, "App Secret", existing.app_secret ?? "") : ""
  } else {
    info("获取凭证：open.feishu.cn → 我的应用 → 选择应用 → 凭证与基础信息")
    app_id     = await ask(rl, "App ID", existing.app_id ?? "")
    app_secret = await ask(rl, "App Secret", existing.app_secret ?? "")
    chat_id    = await ask(rl, "Chat ID（会话 ID）", existing.chat_id ?? "")
  }

  // ── 行为配置 ──
  title("第 3 步：行为配置")
  const auto_push        = await askYN(rl, "AI 每次回复自动推送到飞书？", existing.auto_push ?? false)
  const push_on_complete = await askYN(rl, "任务完成时发飞书通知？",      existing.push_on_complete ?? true)
  const prefix           = await ask(rl, "消息前缀", existing.prefix ?? "🤖 OpenCode")

  rl.close()

  // ── 写入配置 ──
  title("第 4 步：保存配置")
  mkdirSync(GLOBAL_DIR, { recursive: true })

  const config: any = { auto_push, push_on_complete, prefix }
  if (app_id)     config.app_id     = app_id
  if (app_secret) config.app_secret = app_secret
  if (webhook)    config.webhook    = webhook
  if (chat_id)    config.chat_id    = chat_id

  writeFileSync(GLOBAL_CONFIG, JSON.stringify(config, null, 2), "utf-8")
  success(`配置已保存到 ${GLOBAL_CONFIG}`)

  // ── 注册插件 ──
  registerPlugin()

  // ── 完成提示 ──
  print(`
${GREEN}${BOLD}🎉 配置完成！${RESET}

${BOLD}下一步：${RESET}
  重启 OpenCode，插件自动加载生效

${BOLD}使用方式：${RESET}
  在 OpenCode 中说「把结果发到飞书」，AI 会自动调用插件发送

${BOLD}修改配置：${RESET}
  ${DIM}opencode-feishu setup${RESET}   重新运行配置向导
  ${DIM}opencode-feishu show${RESET}    查看当前配置
  ${DIM}opencode-feishu test${RESET}    发送测试消息验证配置
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
  if (cfg.webhook)    cfg.webhook    = cfg.webhook.slice(0, 50) + "..."
  print(JSON.stringify(cfg, null, 2))

} else if (cmd === "test") {
  // 发送测试消息
  title("发送测试消息")
  if (!existsSync(GLOBAL_CONFIG)) {
    warn("配置文件不存在，请先运行：opencode-feishu setup")
    process.exit(1)
  }
  const cfg = JSON.parse(readFileSync(GLOBAL_CONFIG, "utf-8"))
  const text = `${cfg.prefix ?? "🤖 OpenCode"}\n🧪 测试消息 — 配置验证成功！\n时间：${new Date().toLocaleString("zh-CN")}`
  try {
    if (cfg.webhook) {
      const res = await fetch(cfg.webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ msg_type: "text", content: { text } }),
      })
      const data = await res.json() as any
      if (data.code !== 0) {
        warn(`发送失败：${data.msg}`)
      } else {
        success("测试消息已发送，请检查飞书群")
      }
    } else if (cfg.chat_id && cfg.app_id && cfg.app_secret) {
      // chat_id 模式测试
      const tokenRes = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: cfg.app_id, app_secret: cfg.app_secret }),
      })
      const tokenData = await tokenRes.json() as any
      if (tokenData.code !== 0) {
        warn(`获取 Token 失败：${tokenData.msg}`)
      } else {
        const msgRes = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenData.tenant_access_token}` },
          body: JSON.stringify({ receive_id: cfg.chat_id, msg_type: "text", content: JSON.stringify({ text }) }),
        })
        const msgData = await msgRes.json() as any
        if (msgData.code !== 0) {
          warn(`发送失败：${msgData.msg}`)
        } else {
          success("测试消息已发送，请检查飞书")
        }
      }
    } else {
      warn("缺少必要配置，请运行：opencode-feishu setup")
    }
  } catch (e: any) {
    warn(`发送失败：${e.message}`)
  }

} else {
  // 默认：运行配置向导
  main().catch(e => { console.error(e); process.exit(1) })
}
