#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────
# opencode-feishu-plugin 一键安装脚本
# 用法：curl -fsSL <raw_url>/install.sh | bash
# ─────────────────────────────────────────────────────────
set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # 重置颜色

# 日志函数
info()    { echo -e "${CYAN}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
error()   { echo -e "${RED}❌ $1${NC}"; exit 1; }

# ─── 欢迎信息 ──────────────────────────────────────
echo -e "
${BOLD}╔══════════════════════════════════════════╗
║   opencode-feishu-plugin 一键安装脚本    ║
╚══════════════════════════════════════════╝${NC}
"

# ─── 检测包管理器 ──────────────────────────────────
detect_pm() {
  if command -v bun &>/dev/null; then
    echo "bun"
  elif command -v npm &>/dev/null; then
    echo "npm"
  else
    error "未找到 bun 或 npm，请先安装其中一个：
  bun:  curl -fsSL https://bun.sh/install | bash
  npm:  https://nodejs.org"
  fi
}

PM=$(detect_pm)
info "检测到包管理器: ${BOLD}$PM${NC}"

# ─── 临时目录 ──────────────────────────────────────
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# ─── 克隆仓库 ──────────────────────────────────────
REPO_URL="${REPO_URL:-https://github.com/wamjdg/opencode-feishu-plugin.git}"

info "正在克隆仓库..."
if command -v git &>/dev/null; then
  git clone --depth 1 "$REPO_URL" "$TMPDIR/opencode-feishu-plugin" 2>/dev/null || \
    error "克隆仓库失败，请检查网络连接或仓库地址"
else
  error "未找到 git，请先安装 git"
fi

# 进入项目目录
PLUGIN_DIR="$TMPDIR/opencode-feishu-plugin"

# ─── 安装依赖并构建 ────────────────────────────────
info "正在安装依赖..."
if [ "$PM" = "bun" ]; then
  (cd "$PLUGIN_DIR" && bun install --frozen-lockfile 2>/dev/null || bun install)
else
  (cd "$PLUGIN_DIR" && npm install)
fi

info "正在构建..."
if [ "$PM" = "bun" ]; then
  (cd "$PLUGIN_DIR" && bun run build)
else
  (cd "$PLUGIN_DIR" && npm run build)
fi
success "构建完成"

# ─── 全局安装 ──────────────────────────────────────
info "正在全局安装..."
if [ "$PM" = "bun" ]; then
  (cd "$PLUGIN_DIR" && bun link)
else
  # 自动配置 npm global 到用户目录，免去 sudo 安装的密码交互
  NPM_GLOBAL="$HOME/.npm-global"
  mkdir -p "$NPM_GLOBAL"
  npm config set prefix "$NPM_GLOBAL"
  
  (cd "$PLUGIN_DIR" && npm install -g .)

  # 检测并将 npm global 路径加入 PATH 配置
  if [[ ":$PATH:" != *":$NPM_GLOBAL/bin:"* ]]; then
    info "正在为您配置环境变量..."
    RC_FILE=""
    if [ -f "$HOME/.zshrc" ]; then RC_FILE="$HOME/.zshrc"
    elif [ -f "$HOME/.bashrc" ]; then RC_FILE="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then RC_FILE="$HOME/.bash_profile"
    else RC_FILE="$HOME/.profile"; fi
    
    echo "export PATH=\"$NPM_GLOBAL/bin:\$PATH\"" >> "$RC_FILE"
    warn "已将环境变量写入 ${BOLD}$RC_FILE${NC}"
    warn "当前进程结束后，若使用提示 'command not found'，请先执行：${BOLD}source $RC_FILE${NC}"
  fi
fi
success "全局安装完成"

# ─── 注册插件 ──────────────────────────────────────
OC_DIR="$HOME/.config/opencode"
OC_CONFIG="$OC_DIR/opencode.json"

mkdir -p "$OC_DIR"

if [ -f "$OC_CONFIG" ]; then
  # 检查是否已注册
  if grep -q "opencode-feishu-plugin" "$OC_CONFIG" 2>/dev/null; then
    info "插件已在 opencode.json 中注册"
  else
    # 使用 bun/node 来修改 JSON（避免 sed 处理 JSON 的问题）
    if command -v bun &>/dev/null; then
      bun -e "
        const fs = require('fs');
        const cfg = JSON.parse(fs.readFileSync('$OC_CONFIG', 'utf-8'));
        cfg.plugin = cfg.plugin || [];
        if (!cfg.plugin.includes('opencode-feishu-plugin')) cfg.plugin.push('opencode-feishu-plugin');
        fs.writeFileSync('$OC_CONFIG', JSON.stringify(cfg, null, 2));
      "
    elif command -v node &>/dev/null; then
      node -e "
        const fs = require('fs');
        const cfg = JSON.parse(fs.readFileSync('$OC_CONFIG', 'utf-8'));
        cfg.plugin = cfg.plugin || [];
        if (!cfg.plugin.includes('opencode-feishu-plugin')) cfg.plugin.push('opencode-feishu-plugin');
        fs.writeFileSync('$OC_CONFIG', JSON.stringify(cfg, null, 2));
      "
    fi
    success "插件已注册到 opencode.json"
  fi
else
  echo '{"plugin":["opencode-feishu-plugin"]}' | python3 -m json.tool > "$OC_CONFIG" 2>/dev/null || \
    echo '{"plugin":["opencode-feishu-plugin"]}' > "$OC_CONFIG"
  success "已创建 opencode.json 并注册插件"
fi

# ─── 完成提示 ──────────────────────────────────────
echo -e "
${GREEN}${BOLD}🎉 安装完成！${NC}

${BOLD}下一步：${NC}
  若提示 command not found，请先执行 ${CYAN}source ~/.zshrc${NC} (或对应的 profile)。
  运行 ${CYAN}opencode-feishu setup${NC} 配置飞书连接
  
${BOLD}快速开始：${NC}
  1. ${CYAN}opencode-feishu setup${NC}   配置飞书 Webhook 或应用凭证
  2. ${CYAN}opencode-feishu test${NC}    发送测试消息验证
  3. 重启 OpenCode，即可在对话中说「发到飞书」

${BOLD}更多命令：${NC}
  ${CYAN}opencode-feishu show${NC}     查看当前配置
  ${CYAN}opencode-feishu setup${NC}    重新配置
"
