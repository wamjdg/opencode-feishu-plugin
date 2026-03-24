# opencode-feishu-plugin

OpenCode 飞书插件 — 通过飞书群机器人远程操控 OpenCode，支持结果推送、任务通知与群组协作。

---

## 🚀 一键安装

### 方式一：curl 一键安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/wamjdg/opencode-feishu-plugin/main/install.sh | bash
```

安装完成后运行配置向导：

```bash
opencode-feishu setup
```

### 方式二：bun 全局安装

```bash
bun add -g opencode-feishu-plugin
opencode-feishu setup
```

### 方式三：npm 全局安装

```bash
npm install -g opencode-feishu-plugin
opencode-feishu setup
```

### 方式四：从源码安装

```bash
git clone https://github.com/wamjdg/opencode-feishu-plugin.git
cd opencode-feishu-plugin
bun install && bun run build
bun link
opencode-feishu setup
```

---

## 配置向导（无需手动编辑任何 JSON）

```bash
# 初始化配置（首次使用）
opencode-feishu setup

# 查看当前配置（敏感字段自动隐藏）
opencode-feishu show

# 发送测试消息验证配置是否正确
opencode-feishu test
```

运行 `setup` 后全程交互引导：

```
╔══════════════════════════════════════╗
║   opencode-feishu-plugin 配置向导    ║
╚══════════════════════════════════════╝

第 1 步：选择接入模式
  webhook  - 群机器人，配置最简单（推荐新手）
  chat_id  - 自建应用，支持私聊和更多功能
? 选择模式 (webhook / chat_id) [webhook]:

第 2 步：填写飞书凭证
? Webhook 地址: https://open.feishu.cn/open-apis/bot/v2/hook/xxx

第 3 步：行为配置
? AI 每次回复自动推送到飞书？(y/N): n
? 任务完成时发飞书通知？(Y/n): y
? 消息前缀 [🤖 OpenCode]:

✅ 配置已保存到 ~/.config/opencode/feishu.json
✅ 插件已注册到 opencode.json

🎉 配置完成！重启 OpenCode 即可生效
```

---

## 注册插件

`setup` 命令会自动注册，也可以手动在 `~/.config/opencode/opencode.json` 加一行：

```json
{
  "plugin": ["opencode-feishu-plugin"]
}
```

---

## 飞书配置步骤

### 方式一：群机器人 Webhook（推荐新手，5分钟搞定）

1. 飞书群 → 右上角「设置」→「群机器人」→「添加机器人」→「自定义机器人」
2. 复制 Webhook 地址
3. 运行 `opencode-feishu setup`，粘贴地址即可

### 方式二：自建应用（支持私聊）

1. 进入 [open.feishu.cn](https://open.feishu.cn) 创建自建应用
2. 开启「机器人」能力，申请权限 `im:message:send_as_bot`
3. 运行 `opencode-feishu setup` 填入 App ID 和 App Secret

---

## 使用

| 触发方式 | 效果 |
|----------|------|
| 对 AI 说「把结果发到飞书」 | AI 主动调用插件发送 |
| 配置 `auto_push: true` | AI 每次回复自动同步到飞书 |
| 配置 `push_on_complete: true` | 任务结束后飞书自动收到通知 |

---

## 项目结构

```
opencode-feishu-plugin/
├── src/
│   ├── index.ts          # 插件主体（飞书 API + 工具注册）
│   └── setup.ts          # CLI 配置向导
├── dist/                 # 构建产物（自动生成）
├── install.sh           # 一键安装脚本
├── package.json
├── tsconfig.json
└── README.md
```

---

## License

MIT
