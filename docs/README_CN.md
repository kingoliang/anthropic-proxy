# Anthropic API 代理服务器

专为 Claude Code 设计的专业 Anthropic API 代理服务器，具备全面的监控功能。

**[🇺🇸 English Documentation](../README.md)** | **[📁 GitHub 仓库](https://github.com/kingoliang/anthropic-proxy)**

## 📁 项目结构

```
anthropic-proxy/
├── src/                    # 源代码
│   ├── server.js          # 主服务器应用
│   ├── monitor/           # 监控模块
│   │   ├── store.js       # 请求/响应数据存储
│   │   └── ui.js          # Web监控界面
│   └── utils/             # 工具函数
├── docs/                  # 文档
├── examples/              # 配置示例
│   ├── Dockerfile         # Docker容器设置
│   ├── docker-compose.yml # Docker Compose配置
│   └── pm2.config.js      # PM2进程管理
├── package.json
├── README.md
├── .env.example           # 环境变量模板
├── .gitignore
└── LICENSE
```

## ✨ 功能特性

- 🚀 **基于Node.js** 的Anthropic API代理
- 📊 **内置监控仪表板** 实时更新
- 🔒 **API密钥掩码** 安全保护
- 📈 **性能指标** 和token使用跟踪
- 🌊 **流式响应支持** 块级分析
- 💾 **数据导出** 和管理功能
- 🐳 **Docker支持** 包含示例
- ⚡ **生产就绪** PM2配置

## 🚀 快速开始

### 方式1：直接从GitHub运行 (推荐)
```bash
# 无需克隆即可立即运行
npx github:kingoliang/anthropic-proxy

# 或使用自定义配置
PORT=3000 LOG_LEVEL=DEBUG npx github:kingoliang/anthropic-proxy
```

### 方式2：克隆到本地运行
```bash
# 克隆仓库
git clone https://github.com/kingoliang/anthropic-proxy.git
cd anthropic-proxy

# 安装依赖
npm install

# 配置环境变量 (可选)
cp .env.example .env
# 编辑 .env 文件设置你的配置

# 启动服务器
npm start
# 或
npx .
```

### 方式3：全局安装
```bash
# 从GitHub全局安装
npm install -g github:kingoliang/anthropic-proxy

# 在任何地方运行
anthropic-proxy

# 或使用环境变量
PORT=3000 LOG_LEVEL=DEBUG anthropic-proxy
```

### 方式4：开发模式
```bash
# 克隆并链接用于开发
git clone https://github.com/kingoliang/anthropic-proxy.git
cd anthropic-proxy
npm install
npm link

# 在任何地方运行
anthropic-proxy
```

## 环境变量配置

创建 `.env` 文件或设置环境变量：

```bash
# Anthropic API 基础 URL
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 服务器配置
HOST=0.0.0.0
PORT=8082

# 请求超时 (毫秒)
REQUEST_TIMEOUT=120000

# 日志级别
LOG_LEVEL=INFO
```

## 使用示例

```bash
# 使用自定义端口运行
PORT=3000 npx github:kingoliang/anthropic-proxy

# 使用调试模式运行
LOG_LEVEL=DEBUG npx github:kingoliang/anthropic-proxy

# 组合多个环境变量
PORT=3000 LOG_LEVEL=DEBUG ANTHROPIC_BASE_URL=https://api.anthropic.com npx github:kingoliang/anthropic-proxy
```

## API 端点

### 代理端点
- `POST /v1/messages` - 主消息端点 (支持流式响应)
- `POST /v1/messages/count_tokens` - Token计数端点
- `GET /health` - 健康检查
- `GET /` - API信息

### 监控端点
- `GET /monitor` - Web监控仪表板
- `GET /api/monitor/requests` - 获取带过滤的请求列表
- `GET /api/monitor/stats` - 获取实时统计
- `GET /api/monitor/stream` - 服务器发送事件实时更新
- `POST /api/monitor/clear` - 清空所有监控数据
- `GET /api/monitor/export` - 导出监控数据为JSON

## 监控仪表板

访问内置监控界面：`http://localhost:8082/monitor`

### 功能：
- **实时请求/响应跟踪**
- **性能指标仪表板**
- **流式响应块时间线可视化**
- **API密钥掩码** 保护安全
- **高级过滤** (状态、模型、时间范围)
- **数据导出功能**
- **SSE自动刷新**

### 仪表板模块：
1. **统计面板** - 总请求数、成功率、平均耗时
2. **请求列表** - 可过滤的API调用表格
3. **详情视图** - 完整的请求/响应检查
4. **流分析** - 逐块流式响应可视化
5. **导出工具** - JSON数据导出功能

## 安全说明

- API密钥在日志和监控界面中自动掩码
- 显示前10个字符 + "..." + 后4个字符
- 监控界面无需认证 (本地使用)
- 请求日志中过滤敏感头信息

## 系统要求

- **Node.js 18+**
- **API密钥**: 客户端必须通过头信息提供API密钥 (`x-api-key` 或 `authorization`)
- **网络**: 对Anthropic API的出站访问

## 🎯 在 Claude Code 中使用

代理服务器运行后，配置 Claude Code 使用它：

### 步骤1：启动代理服务器
```bash
# 在默认端口8082启动
npx github:kingoliang/anthropic-proxy

# 或在自定义端口启动 (如：3000)
PORT=3000 npx github:kingoliang/anthropic-proxy
```

### 步骤2：配置 Claude Code 环境
设置环境变量指向你的代理：

```bash
# 默认端口8082
export ANTHROPIC_BASE_URL=http://localhost:8082

# 自定义端口 (如：3000)
export ANTHROPIC_BASE_URL=http://localhost:3000
```

### 步骤3：启动 Claude Code
```bash
# Claude Code 现在将使用你的代理服务器
claude-code
```

### 其他配置方法

**方法1：内联环境变量**
```bash
ANTHROPIC_BASE_URL=http://localhost:8082 claude-code
```

**方法2：添加到shell配置文件**
```bash
# 添加到 ~/.bashrc, ~/.zshrc, 或 ~/.profile
echo 'export ANTHROPIC_BASE_URL=http://localhost:8082' >> ~/.bashrc
source ~/.bashrc
```

**方法3：创建启动脚本**
```bash
#!/bin/bash
# start-claude-with-proxy.sh
export ANTHROPIC_BASE_URL=http://localhost:8082
claude-code
```

### 验证
1. **检查代理运行**: 访问 `http://localhost:8082/monitor`
2. **测试 Claude Code**: 在Claude Code中发起任何请求
3. **监控请求**: 在监控仪表板中观察实时请求

## 技术细节

- **框架**: Express.js 配合 ES 模块
- **监控**: 内存存储配合循环缓冲区 (最多1000个请求)
- **实时更新**: 服务器发送事件 (SSE)
- **流处理**: 完整块跟踪和内容合并
- **错误处理**: 全面的错误捕获和日志记录

## 🐳 生产环境部署

### Docker
```bash
# 使用Docker构建和运行
docker build -t anthropic-proxy .
docker run -p 8082:8082 -e ANTHROPIC_API_KEY=your_key anthropic-proxy

# 或使用Docker Compose
docker-compose -f examples/docker-compose.yml up
```

### PM2 (进程管理器)
```bash
# 安装PM2
npm install -g pm2

# 使用PM2启动
pm2 start examples/pm2.config.js

# 监控
pm2 monit

# 停止
pm2 stop anthropic-proxy
```

### Systemd 服务
```bash
# 创建服务文件
sudo nano /etc/systemd/system/anthropic-proxy.service

# 添加服务配置
[Unit]
Description=Anthropic API Proxy
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/path/to/anthropic-proxy
ExecStart=/usr/bin/node src/server.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=8082

[Install]
WantedBy=multi-user.target

# 启用并启动
sudo systemctl enable anthropic-proxy
sudo systemctl start anthropic-proxy
```

## 🔧 故障排除

### 常见问题：

1. **端口被占用**: 更改PORT环境变量
2. **API密钥不工作**: 验证密钥格式和头信息
3. **超时错误**: 增加REQUEST_TIMEOUT值
4. **内存使用**: 监控数据在1000个请求后自动轮换
5. **模块未找到**: 确保在正确目录运行

### 调试模式：
```bash
LOG_LEVEL=DEBUG npx github:kingoliang/anthropic-proxy
```

### 健康检查：
```bash
curl http://localhost:8082/health
```

## 🔗 相关链接

- **GitHub 仓库**: https://github.com/kingoliang/anthropic-proxy
- **NPM 包**: `npx github:kingoliang/anthropic-proxy`
- **Anthropic API 文档**: https://docs.anthropic.com/
- **Docker Hub**: (即将推出)

## 🤝 贡献

此代理服务器专为开发和测试目的设计。欢迎贡献：

1. Fork 仓库
2. 创建功能分支
3. 进行更改
4. 添加测试 (如适用)
5. 提交拉取请求

## 📄 许可证

MIT 许可证 - 详见 [LICENSE](../LICENSE)。

## 🙏 致谢

- 使用 [Express.js](https://expressjs.com/) 构建
- 监控UI由 [Alpine.js](https://alpinejs.dev/) 和 [Tailwind CSS](https://tailwindcss.com/) 驱动
- 在 [Claude Code](https://claude.ai/code) 的协助下生成