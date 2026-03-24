import type { Plugin } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"

// ─────────────────────────────────────────
// 配置类型定义
// ─────────────────────────────────────────
interface FeishuConfig {
  app_id: string
  app_secret: string
  webhook?: string           // 群机器人 Webhook（简单模式）
  chat_id?: string           // 指定推送的会话 ID（高级模式）
  auto_push: boolean         // AI 回复是否自动推送到飞书
  push_on_complete: boolean  // 任务完成时是否推送通知
  prefix?: string            // 消息前缀，默认 "🤖 OpenCode"
}

// ─────────────────────────────────────────
// 读取配置文件
// 优先级：项目目录 > 全局目录 > 环境变量
// ─────────────────────────────────────────
function loadConfig(): FeishuConfig {
  const configPaths = [
    join(process.cwd(), ".opencode", "feishu.json"),
    join(homedir(), ".config", "opencode", "feishu.json"),
  ]
  for (const p of configPaths) {
    if (existsSync(p)) {
      try {
        return mergeWithDefaults(JSON.parse(readFileSync(p, "utf-8")))
      } catch (e) {
        console.warn(`[feishu-plugin] 配置文件解析失败: ${p}`, e)
      }
    }
  }
  return mergeWithDefaults({
    app_id:     process.env.FEISHU_APP_ID,
    app_secret: process.env.FEISHU_APP_SECRET,
    webhook:    process.env.FEISHU_WEBHOOK,
    chat_id:    process.env.FEISHU_CHAT_ID,
  })
}

function mergeWithDefaults(cfg: Partial<FeishuConfig>): FeishuConfig {
  return {
    app_id:           cfg.app_id     ?? "",
    app_secret:       cfg.app_secret ?? "",
    webhook:          cfg.webhook,
    chat_id:          cfg.chat_id,
    auto_push:        cfg.auto_push        ?? false,
    push_on_complete: cfg.push_on_complete ?? true,
    prefix:           cfg.prefix           ?? "🤖 OpenCode",
  }
}

// ─────────────────────────────────────────
// 配置验证
// webhook 模式只需要 webhook 地址
// chat_id 模式需要 app_id + app_secret + chat_id
// ─────────────────────────────────────────
function validateConfig(cfg: FeishuConfig): string | null {
  if (cfg.webhook) return null // webhook 模式，无需 app_id/secret
  if (cfg.chat_id) {
    if (!cfg.app_id || !cfg.app_secret) return "chat_id 模式需要配置 app_id 和 app_secret"
    return null
  }
  return "webhook 和 chat_id 至少配置一个"
}

// ─────────────────────────────────────────
// 飞书 API
// ─────────────────────────────────────────
let _tokenCache: { token: string; expireAt: number } | null = null

async function getToken(cfg: FeishuConfig): Promise<string> {
  const now = Date.now()
  if (_tokenCache && _tokenCache.expireAt > now + 60_000) return _tokenCache.token
  const res  = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: cfg.app_id, app_secret: cfg.app_secret }),
  })
  const data = await res.json() as any
  if (data.code !== 0) throw new Error(`获取 Token 失败: ${data.msg}`)
  _tokenCache = { token: data.tenant_access_token, expireAt: now + data.expire * 1000 }
  return _tokenCache.token
}

async function sendViaWebhook(cfg: FeishuConfig, text: string) {
  const res  = await fetch(cfg.webhook!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ msg_type: "text", content: { text } }),
  })
  const data = await res.json() as any
  if (data.code !== 0) throw new Error(`Webhook 发送失败: ${data.msg}`)
}

async function sendViaChatId(cfg: FeishuConfig, text: string) {
  const token = await getToken(cfg)
  const res   = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ receive_id: cfg.chat_id, msg_type: "text", content: JSON.stringify({ text }) }),
  })
  const data = await res.json() as any
  if (data.code !== 0) throw new Error(`消息发送失败: ${data.msg}`)
}

async function send(cfg: FeishuConfig, content: string) {
  const text = `${cfg.prefix}\n${content}`
  if (cfg.webhook)    return sendViaWebhook(cfg, text)
  if (cfg.chat_id)    return sendViaChatId(cfg, text)
}

// ─────────────────────────────────────────
// 插件主体
// ─────────────────────────────────────────
export const FeishuPlugin: Plugin = async () => {
  const cfg = loadConfig()
  const err = validateConfig(cfg)

  if (err) {
    console.warn(`[feishu-plugin] ⚠️  ${err}`)
    console.warn(`[feishu-plugin] 请运行配置向导：opencode-feishu setup`)
    console.warn(`  或手动创建配置文件：`)
    console.warn(`  项目级: .opencode/feishu.json`)
    console.warn(`  全局:   ~/.config/opencode/feishu.json`)
    return {}
  }

  console.log(`[feishu-plugin] ✅ 已加载 (${cfg.chat_id ? "chat_id" : "webhook"} 模式)`)

  return {
    tool: {
      send_to_feishu: {
        description: "把当前代码、分析结果或任意内容发送到飞书群",
        args: {
          message: { type: "string", description: "要发送到飞书的内容" },
        },
        async execute({ message }: { message: string }) {
          try {
            await send(cfg, message)
            return "✅ 已成功发送到飞书"
          } catch (e: any) {
            return `❌ 发送失败：${e.message}`
          }
        },
      },
    },

    "chat.message": async (_ctx: any, { message }: any) => {
      if (!cfg.auto_push) return
      if (message?.role !== "assistant" || !message?.content) return
      try { await send(cfg, message.content) } catch {}
    },

    event: async ({ event }: any) => {
      if (!cfg.push_on_complete) return
      if (event?.type !== "session.idle") return
      try { await send(cfg, "✅ 本次任务已全部完成") } catch {}
    },
  }
}

export default FeishuPlugin
