# 学院资料归档 · 在线演示

一个可直接部署到 GitHub Pages 的 Vue 3 静态演示项目。无需后端、数据库服务或账号，打开即可体验。

**在线体验：<https://GuHang2011.github.io/college-archive-demo/>**

## 可以体验什么

- 工作台：资料总数、待审核、已通过及本地存储用量。
- 四套主题：青竹绿、学院蓝、暖砂金、海棠红，刷新后保留。
- 资料归档：选择文件、摄像头拍照、预览、下载、搜索、分类和状态筛选。
- 限时任务：按任务提交资料、查看提交数量和截止状态。
- 模拟审核：切换到「管理员体验」，通过或驳回待审核资料，并填写修改意见。
- AI 助手：连续问答、归档清单分析、说明起草、复制回复及填入归档备注。支持 DeepSeek / OpenAI 兼容的 Chat Completions 接口。
- 一键重置：恢复五份生成的示例资料，清除本浏览器中的试传文件与审核操作。

所有示例资料均为合成数据。试传文件和审核结果保存在访问者自己的浏览器 IndexedDB 中，不会上传服务器，也不会与其他访问者共享。演示角色切换用于体验流程，不是正式身份认证。连接 AI 后，发送的问题、最近最多 6 轮 AI 对话及主动勾选的归档清单元数据会发送到所配置的模型服务；不发送文件正文或照片。

演示版单文件上限 20 MB、每次最多 20 个、总存储上限 50 MB。实际可用空间由浏览器决定。清理网站数据、隐私模式结束或浏览器回收存储后，试传资料可能丢失，请保留原件。

摄像头需要 HTTPS 或本机 localhost，并需要用户授权。只申请视频权限，不录音；确认拍照、取消或离开页面时释放摄像头。手机镜头切换能力取决于设备和浏览器。

## 本地运行

需要 Node.js 22.9+（建议 Node.js 22 LTS 或更新版本）。

```bash
npm ci
npm run dev
```

## 构建与部署

```bash
npm run build
npm run preview
```

`dist/` 可部署到任何静态托管服务。Vite 使用相对资源路径，兼容 GitHub Pages 项目子路径。页面导航使用 hash，刷新不会依赖服务器路由。

本仓库的 `docs/` 为已验证的构建产物，GitHub Pages 从默认分支的 `/docs` 目录发布。更新源码后重新构建，将 `dist/` 内容同步至 `docs/` 并提交即可发布更新。

## 连接真实 AI

默认提供明确标注的**离线指引**：内置操作步骤、规则统计和说明模板，不调用模型，也不伪装成 AI 回复。自由问答和多轮生成需连接以下服务。

1. 执行 `npm run setup:ai`，生成被 Git 忽略的 `.env` 和随机服务访问码（不会覆盖已有配置）。在本机编辑 `.env` 的 `AI_API_KEY`（服务商密钥）。`AI_ACCESS_TOKEN` 是单独的服务访问码，不是 API Key。不要在聊天或 GitHub 中提交密钥。
2. DeepSeek 默认 `AI_BASE_URL=https://api.deepseek.com`、`AI_MODEL=deepseek-flash`，调用关闭思考模式以便快速生成简短建议。参数依据 [DeepSeek 官方 Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion)。其他兼容服务填写对应基础地址和可用模型，地址不包含 `/chat/completions`，不会附带 DeepSeek 的专用参数。
3. 执行 `npm run build`，然后 `npm run start`。服务默认仅监听 `http://127.0.0.1:4175`。如果端口已被预览服务占用，先关闭该预览服务。
4. 打开「AI 助手 → 连接 AI」，填写助手服务地址和 `AI_ACCESS_TOKEN`，点击「检查并连接」。检查只验证服务配置，不消耗模型额度；首次发送才请求模型。

密钥只保留在服务端环境变量中，不下发浏览器。前端不保存访问码或对话到浏览器存储；刷新后需重新连接。助手不能自动上传、删除或审核资料；「用于归档备注」只填入草稿，仍需用户选择文件并提交。回复超过 300 字时可复制后手动精简。清空对话和重置演示数据都会清除会话。

GitHub Pages 只托管静态文件，**不能运行 Node 服务或保管服务端密钥**。线上真实 AI 需将 `server/` 与 `dist/` 部署到支持 Node 的服务器，设置 `HOST=0.0.0.0`，在反向代理启用 HTTPS，并将页面的精确 origin 加入 `AI_ALLOWED_ORIGINS`。然后在 Pages 的连接设置中填写该 HTTPS 服务地址；也可构建前设置公开的 `VITE_AI_GATEWAY` 预填地址。API Key 和访问码绝不能使用 `VITE_` 前缀。

这是小规模受控演示网关：默认全服务每小时最多 60 次请求、并发 2、模型等待最多 55 秒、每次输出最多 1600 tokens。访问码不应公开；公开运营应接入真实账号认证和持久化限额。服务只接受文本及最多 20 条清单元数据，服务端重建字段，不转发文件或客户端指定的模型、密钥、system 指令。错误不透传服务商内部响应。断开请求会取消上游，但已生成的 token 仍可能计费。

开发时可使用 `npm run dev` 开页面，同时在另一个端口运行网关，并将开发页面的 origin 加入 `AI_ALLOWED_ORIGINS`。

## 验证

```bash
npm run typecheck
npm run test:assistant
npm run build
npx playwright install chromium
npm run test:browser
npm run test:assistant:browser
```

Windows 测试默认使用已安装的 Edge；其他系统使用 Playwright Chromium。可通过 `TEST_BROWSER_EXECUTABLE` 指定浏览器路径。测试使用模拟摄像头，但真实运行应用的 IndexedDB、上传、预览、下载、任务及审核代码，不模拟后端接口。截图与报告输出到 `test-results/`（不提交）。

通过 `DEMO_BASE_URL` 可对已部署站点运行同一套验证，操作仅影响测试浏览器自己的本地数据。

## 范围

这是正式系统部分功能的独立演示，聚焦换肤、拍照、归档审核及可选 AI 辅助；不提供真实用户认证、多人协作、服务器文件存储或正式用印。自动化验证中的模型响应使用明确的测试夹具，不代表真实模型调用；实际服务商连通性和效果需配置有效密钥后验证。
