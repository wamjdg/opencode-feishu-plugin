# opencode-feishu-plugin

OpenCode 飞书插件 — 通过长连接与 OpenCode 双向通信，支持从飞书私聊/群聊直接操作 AI 并接收回复。

---

## 🚀 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/wamjdg/opencode-feishu-plugin/main/install.sh | bash
```

安装完成后，在终端运行配置向导：

```bash
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

### 第三步：运行插件向导填写凭证

在你的电脑终端运行：

```bash
opencode-feishu setup
```

按照提示分别填入 `App ID` 和 `App Secret`，然后**重启 OpenCode** 即可生效。

---

## 🕹️ 使用方式

在此模式下，你无需配置 `chat_id`。只需：
1. 在飞书里打开机器人的**单聊会话**。
2. 发送任意想让 AI 执行的指令。
3. 你的电脑（OpenCode 端）会自动处理并把生成的代码或回复推送到你飞书的单聊窗口中。

---

## ⚙️ 配置文件

配置文件存放在 `~/.config/opencode/feishu.json`。核心字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `app_id` | ✅ | 飞书应用 App ID |
| `app_secret` | ✅ | 飞书应用 App Secret |
| `default_chat_id` | ❌ | （可选）如果你想让 OpenCode 中执行的任务自动发送通知，可填入你群聊的 `chat_id` |
| `push_on_complete`| ❌ | （可选）任务进入 idle 状态时推送提示（需搭配 default_chat_id） |

---

## License

MIT
