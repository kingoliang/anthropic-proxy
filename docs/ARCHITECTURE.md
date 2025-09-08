# 系统架构文档

## 系统概览
- Node.js/Express 服务器，支持 Anthropic 直连与 OpenRouter 模式的动态切换
- 监控子系统：请求追踪、SSE 实时更新、统计与分析、数据导出
- 配置子系统：Web 配置 UI、运行时配置生效、模型列表动态加载、环境变量优先

## 模块分层与交互
```mermaid
graph LR
  subgraph Client
    CC[Claude Code CLI/IDE]
    BR[Browser - Monitor/Config]
  end

  CC -->|HTTP /v1/messages| S(Server)
  BR -->|HTTP /monitor,/config,/api/*| S

  subgraph Server[Express App src/server.js]
    direction TB
    R1[Routes<br/>/v1/messages<br/>/v1/messages/count_tokens<br/>/health<br/>/ redirect to /monitor<br/>/monitor<br/>/api/monitor/*<br/>/config<br/>/api/config/*]
    LOG[Logger]
    CFG[configManager<br/>src/config/manager.js]
    MON[requestStore<br/>src/monitor/store.js]
    UI1[getMonitorHTML<br/>src/monitor/ui.js]
    UI2[getConfigHTML<br/>src/config/ui.js]
    ANA[analysis<br/>src/monitor/analysis.js]
    ORH[OpenRouterHandler<br/>src/routers/openrouter.js]
    CONV[OpenRouter Converter<br/>src/converters/openrouter.js]
  end

  R1 --> LOG
  R1 --> CFG
  R1 --> MON
  R1 --> UI1
  R1 --> UI2
  R1 --> ANA
  R1 --> ORH

  subgraph Backends
    AAPI[Anthropic API]
    ORAPI[OpenRouter API]
  end

  R1 -.->|proxyMode=anthropic| AAPI
  R1 -.->|proxyMode=openrouter| ORH 
  ORH --> CONV
  ORH --> ORAPI
  CONV -.->|map back| R1
  MON -->|SSE updates| BR
```

## 请求路径与路由逻辑
```mermaid
sequenceDiagram
  participant C as Claude Code
  participant S as Server (/v1/messages)
  participant CFG as configManager
  participant ORH as OpenRouterHandler
  participant A as Anthropic API
  participant OR as OpenRouter API

  C->>S: POST /v1/messages (stream? boolean)
  S->>CFG: getConfig()
  alt proxyMode = openrouter
    alt stream = true
      S->>ORH: handleStreamingRequest(req,res)
      ORH->>OR: POST /chat/completions (stream)
      OR-->>ORH: SSE chunks
      ORH-->>S: mapped SSE chunks (Anthropic format)
    else stream = false
      S->>ORH: handleRequest(req,res)
      ORH->>OR: POST /chat/completions
      OR-->>ORH: JSON response
      ORH-->>S: mapped JSON (Anthropic format)
    end
  else proxyMode = anthropic
    S->>A: POST /v1/messages (stream or JSON)
    A-->>S: response (SSE or JSON)
  end
  S-->>C: passthrough/mapped response
```

## 监控与实时更新
```mermaid
flowchart LR
  subgraph Monitor
    RS[requestStore<br/>startRequest id<br/>addStreamChunk id<br/>setMergedContent id<br/>endRequest id<br/>getAll filters<br/>getStats<br/>Events: requestStart/requestEnd/requestError/streamChunk]
    SSE[SSE endpoint /api/monitor/stream]
    UI[Monitor UI /monitor]
    ANA[Analysis /api/monitor/analyze<br/>Export /api/monitor/export]
  end
  Routes[Server Routes] --> RS
  RS --> SSE
  SSE --> UI
  RS --> ANA
```

## 配置子系统与动态生效
```mermaid
flowchart TB
  UI[Config UI - /config]
  API[API Endpoints<br/>/api/config<br/>/api/config/reset<br/>/api/config/models<br/>/api/config/reload<br/>/api/config/test-openrouter]
  CM[configManager<br/>getConfig<br/>updateConfig<br/>reloadConfig<br/>addListener<br/>validateOpenRouterKey<br/>getAvailableModels]
  ENV[(Environment Variables<br/>OPENROUTER_API_KEY)]
  FILE[(config.json<br/>proxyMode mappings timeouts)]
  ORAPI[OpenRouter API]

  UI --> API --> CM
  CM --> FILE
  CM --> ENV
  CM --> ORAPI
  CM -->|listener push updates| Server[Express App]
```

## 关键端点清单
- 代理：`POST /v1/messages`, `POST /v1/messages/count_tokens`, `GET /health`, `GET /`
- 监控：`GET /monitor`, `GET /api/monitor/requests`, `GET /api/monitor/requests/:id`, `GET /api/monitor/stats`, `GET /api/monitor/stream`, `POST /api/monitor/clear`, `GET /api/monitor/export`, `GET /api/monitor/analyze`, `GET /api/monitor/config`
- 配置：`GET /config`, `GET/POST /api/config`, `POST /api/config/reset`, `POST /api/config/test-openrouter`, `GET /api/config/models`, `POST /api/config/reload`

## 安全与合规
- API 密钥仅从环境变量读取并在 UI/日志中掩码
- config.json 仅包含非敏感设置与映射
- 监控面板用于本地开发，SSE 实时更新，不含敏感数据内容泄露

## 可扩展点
- 在 `converters/` 中增加新的提供商映射器
- 在 `routers/` 添加新的后端路由处理器
- `requestStore` 存储后端可替换为持久化存储
- 配置 UI 增加更多动态校验与模型元数据展示
