# Anthropic API Proxy

一个用于转发请求到 Anthropic API 的代理服务器，专为 Claude Code 设计。

## 使用 npx 运行

### 方式 1：直接从本地目录运行
```bash
# 在项目目录中
npx .

# 或者指定端口
PORT=3000 npx .
```

### 方式 2：全局安装后运行
```bash
# 全局安装
npm install -g .

# 运行
anthropic-proxy

# 或带环境变量
PORT=3000 anthropic-proxy
```

### 方式 3：使用 npm link（开发模式）
```bash
# 在项目目录创建全局链接
npm link

# 运行
anthropic-proxy
```

### 方式 4：直接运行脚本
```bash
# 确保有执行权限
chmod +x anthropic_proxy.js

# 直接运行
./anthropic_proxy.js
```

## 环境变量配置

创建 `.env` 文件或设置环境变量：

```bash
# Anthropic API 基础 URL
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 服务器配置
HOST=0.0.0.0
PORT=8082

# 请求超时（毫秒）
REQUEST_TIMEOUT=120000

# 日志级别
LOG_LEVEL=INFO
```

## 临时运行示例

```bash
# 使用自定义端口运行
PORT=3000 npx .

# 使用调试模式运行
LOG_LEVEL=DEBUG npx .

# 组合多个环境变量
PORT=3000 LOG_LEVEL=DEBUG ANTHROPIC_BASE_URL=https://api.anthropic.com npx .
```

## API 端点

- `POST /v1/messages` - 主消息端点（支持流式响应）
- `POST /v1/messages/count_tokens` - Token 计数端点
- `GET /health` - 健康检查
- `GET /` - API 信息

## 注意事项

- 客户端必须通过请求头提供 API key（`x-api-key` 或 `authorization`）
- 代理会自动转发必要的头信息到 Anthropic API
- 支持完整的请求/响应日志（可通过 LOG_LEVEL 控制）