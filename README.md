# opencode-feishu-plugin

OpenCode 飞书插件 — 通过长连接与 OpenCode 双向通信，支持从飞书私聊/群聊直接操作 AI 并接收回复。

---

## 🚀 安装

### 方式一：curl 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/wamjdg/opencode-feishu-plugin/main/install.sh | bash
```

安装完成后配置凭证：

```bash
opencode-feishu setup
```

### 方式二：从源码安装

```bash
git clone https://github.com/wamjdg/opencode-feishu-plugin.git
cd opencode-feishu-plugin
npm install && npm run build
bun link
opencode-feishu setup
```

---

## 飞书配置步骤（三步搞定双向通信）

此插件基于**飞书官方长连接（WebSocket）**开发。
**无需公网 IP，无需 ngrok 内网穿透，无需配置路由端口**，只需提供 `App ID` 和 `App Secret` 即可。

### 第一步：创建飞书机器人

1. 登录 [飞书开发者后台](https://open.feishu.cn) 创建自建应用
2. 开启左侧「添加应用能力」中的 **机器人** 功能
3. 进入「权限管理」，搜索并申请以下两个权限：
   - `im:message:send_as_bot`（获取机器人发送单聊消息权限）
   - `im:message.p2p_msg:readonly`（获取单聊消息读取权限）

### 第二步：配置事件订阅为“长连接”

1. 进入开发者后台左侧 → **事件订阅**
2. 在页面顶部找到并勾选：**“使用长连接接收事件”**
3. 在“添加事件”中，勾选：**`im.message.receive_v1`（接收消息事件）**
4. 点击“创建版本”并发布你的应用。

### 第三步：运行插件向导并填入凭证

在终端运行以下命令：

```bash
opencode-feishu setup
```

```
╔══════════════════════════════════════╗
║   opencode-feishu-plugin 配置向导    ║
╚══════════════════════════════════════╝

第 1 步：填写飞书应用凭证
ℹ️  获取凭证：open.feishu.cn → 我的应用 → 选择应用 → 凭证与基础信息
? App ID: cli_XXXXXXXXXX
? App Secret: XXXXXXXXXXXX

第 2 步：默认推送目标（可选）
  如需让 AI 主动给飞书发消息，填写目标群/私聊对应的 chat_id（oc_xxx格式）
? 默认推送 Chat ID:

第 3 步：行为配置
? AI 每次回复自动推送到飞书？(y/N): n
? 任务完成时发飞书通知？(Y/n): y
? 消息前缀 [🤖 OpenCode]:

✅ 配置已保存
```

重启 OpenCode，即可在飞书里直接和机器人聊天，它会把你的指令发给电脑上的 OpenCode 执行并返回结果！

---

## 使用方式

| 场景 | 操作 |
|------|------|
| **在飞书里控制 OpenCode** | 直接在飞书向机器人发消息 → OpenCode 自动处理 → 飞书收到回复 |
| AI 主动推送到飞书 | 对 AI 说「把结果发到飞书」（需配置 `default_chat_id`）|
| 任务完成通知 | 默认开启，当 OpenCode 执行完一个复杂任务时飞书提醒你 |

---

## 配置文件结构

配置文件始终存放在 `~/.config/opencode/feishu.json`。

| 字段 | 必填 | 说明 |
|------|------|------|
| `app_id` | ✅ | 飞书应用 App ID |
| `app_secret` | ✅ | 飞书应用 App Secret |
| `default_chat_id` | ❌ | 只在使用 AI 发送工具/自动推送时才需要 |
| `auto_push` | ❌ | 将 OpenCode 的各种输出自动推送到群里（默认 `false`） |
| `push_on_complete`| ❌ | 任务进入 idle 状态时推送提示（默认 `true`） |
| `prefix` | ❌ | 自定义机器人发消息时的统一前缀文本 |

---

## License

MIT
