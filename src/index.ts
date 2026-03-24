import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { z } from "zod"
import { readFileSync, existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import * as lark from "@larksuiteoapi/node-sdk"

// ─────────────────────────────────────────
// 配置类型定义
// ─────────────────────────────────────────
interface FeishuConfig {
  app_id: string
  app_secret: string
  auto_push: boolean          // AI 回复是否自动推送到飞书
  push_on_complete: boolean   // 任务完成时是否推送通知
  prefix?: string             // 消息前缀，默认 "🤖 OpenCode"
  default_chat_id?: string    // 默认推送目标会话 ID（用于 auto_push / push_on_complete）
}

// ─────────────────────────────────────────
// 读取配置文件
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
    app_id:          process.env.FEISHU_APP_ID,
    app_secret:      process.env.FEISHU_APP_SECRET,
    default_chat_id: process.env.FEISHU_DEFAULT_CHAT_ID,
  })
}

function mergeWithDefaults(cfg: Partial<FeishuConfig>): FeishuConfig {
  return {
    app_id:           cfg.app_id           ?? "",
    app_secret:       cfg.app_secret       ?? "",
    auto_push:        cfg.auto_push        ?? false,
    push_on_complete: cfg.push_on_complete ?? true,
    prefix:           cfg.prefix           ?? "🤖 OpenCode",
    default_chat_id:  cfg.default_chat_id,
  }
}

// ─────────────────────────────────────────
// 配置验证
// ─────────────────────────────────────────
function validateConfig(cfg: FeishuConfig): string | null {
  if (!cfg.app_id || !cfg.app_secret) return "需要配置 app_id 和 app_secret"
  return null
}

// ─────────────────────────────────────────
// 飞书长连接及消息收发逻辑
// ─────────────────────────────────────────
function startFeishuWsClient(cfg: FeishuConfig, openCodeClient: any, project: any): lark.Client {
  // 1. 初始化普通的 Feishu Client (用于主动发送消息)
  const feishuClient = new lark.Client({
    appId: cfg.app_id,
    appSecret: cfg.app_secret,
    // 默认关闭内部调试日志可避免刷屏，需要时可配 logger: lark.Logger(...)
  })

  // 2. 初始化 WS Client (长连接，用于接收事件)
  const wsClient = new lark.WSClient({
    appId: cfg.app_id,
    appSecret: cfg.app_secret,
  })

  // 3. 注册事件接收回调
  wsClient.register({
    "im.message.receive_v1": async (data: any) => {
      // 解析消息事件
      const event = data.event
      const sender = event?.sender
      const message = event?.message

      // 过滤掉机器人自己发的消息，防止死循环
      if (sender?.sender_type === "bot") return

      const open_id = sender?.sender_id?.open_id
      const msgType = message?.message_type
      const content = message?.content

      if (!open_id || msgType !== "text" || !content) return

      let text: string
      try {
        text = JSON.parse(content).text?.trim()
      } catch {
        return
      }

      if (!text) return

      console.log(`[feishu-plugin] 📩 收到消息 from ${open_id}: ${text.slice(0, 50)}`)

      // 通知用户正在处理（私聊）
      try {
        await feishuClient.im.v1.message.create({
          params: { receive_id_type: "open_id" },
          data: {
            receive_id: open_id,
            msg_type: "text",
            content: JSON.stringify({ text: "⏳ 正在处理中，请稍候…" })
          }
        })
      } catch(e) {
         // ignore
      }

      // 调用 OpenCode 处理消息
      try {
        // 创建新会话
        const session = await openCodeClient.session.create({ projectID: project.id })
        const sessionID = session.id

        // 收集 AI 的全部回复片段
        const parts: string[] = []

        // 发送消息并流式读取回复
        for await (const streamEvent of openCodeClient.session.chat(sessionID, { text })) {
          if (streamEvent?.type === "assistant" && streamEvent?.part?.type === "text") {
            parts.push(streamEvent.part.text ?? "")
          }
          // 会话结束信号
          if (streamEvent?.type === "session.idle" || streamEvent?.type === "idle") break
        }

        const reply = parts.join("").trim() || "（无回复内容）"
        const replyText = `${cfg.prefix}\n${reply}`

        // 回复给飞书用户（私聊）
        await feishuClient.im.v1.message.create({
          params: { receive_id_type: "open_id" },
          data: {
            receive_id: open_id,
            msg_type: "text",
            content: JSON.stringify({ text: replyText })
          }
        })
        console.log(`[feishu-plugin] ✅ 已回复 ${open_id}`)
      } catch (e: any) {
        console.error(`[feishu-plugin] ❌ OpenCode 调用失败:`, e.message)
        try {
          await feishuClient.im.v1.message.create({
            params: { receive_id_type: "open_id" },
            data: {
              receive_id: open_id,
              msg_type: "text",
              content: JSON.stringify({ text: `❌ 处理失败：${e.message}` })
            }
          })
        } catch { /* ignore */ }
      }
    }
  })

  // 4. 启动 WebSocket 长连接
  wsClient.start()
  console.log(`[feishu-plugin] 🚀 飞书长连接（WebSocket）已启动！无需公网 IP 即可接收事件。`)

  return feishuClient
}

// ─────────────────────────────────────────
// 插件主体
// ─────────────────────────────────────────
export const FeishuPlugin: Plugin = async (input) => {
  const cfg = loadConfig()
  const err = validateConfig(cfg)

  if (err) {
    console.warn(`[feishu-plugin] ⚠️  ${err}`)
    console.warn(`[feishu-plugin] 请运行配置向导：opencode-feishu setup`)
    return {}
  }

  // 启动飞书 WebSocket 事件客户端
  const feishuClient = startFeishuWsClient(cfg, input.client, input.project)

  // 向默认推送目标发消息封装
  const sendToDefault = async (content: string) => {
    if (!cfg.default_chat_id) return
    const text = `${cfg.prefix}\n${content}`
    try {
      await feishuClient.im.v1.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: cfg.default_chat_id,
          msg_type: "text",
          content: JSON.stringify({ text })
        }
      })
    } catch (e: any) {
      console.warn(`[feishu-plugin] 发送到默认 chat_id 失败: ${e.message}`)
    }
  }

  return {
    tool: {
      // 手动推送工具：让 AI 主动发送内容到飞书
      send_to_feishu: tool({
        description: "把当前代码、分析结果或任意内容发送到飞书（需已配置 default_chat_id）",
        args: {
          message: z.string().describe("要发送到飞书的内容"),
        },
        async execute({ message }) {
          if (!cfg.default_chat_id) return "❌ 未配置 default_chat_id，无法主动推送"
          await sendToDefault(message)
          return "✅ 已成功发送到飞书"
        },
      }),
    },

    // AI 每次回复时自动同步到飞书（需配置 default_chat_id）
    "chat.message": async (_input, { message }) => {
      if (!cfg.auto_push || !cfg.default_chat_id) return
      if (message?.role !== "assistant" || !message?.content) return
      if (typeof message.content === "string") {
        await sendToDefault(message.content)
      }
    },

    // 任务完成时推送通知
    event: async ({ event }) => {
      if (!cfg.push_on_complete || !cfg.default_chat_id) return
      if (event?.type === "session.idle") {
        await sendToDefault("✅ 本次任务已全部完成")
      }
    },
  }
}

export default FeishuPlugin
