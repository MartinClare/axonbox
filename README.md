# AXON Case — 工地行政 AI 平台（Web 演示版）

用手機拍一張地盤相，開始整個工地行政流程。

## 用 Chrome / Edge 直接打开

本机服务启动后，在浏览器地址栏粘贴：

| 入口 | 地址 |
|------|------|
| 本机（推荐工程自测） | http://localhost:3003 |
| 登录页 | http://localhost:3003/login |
| 局域网同网段手机/电脑 | http://192.168.10.54:3003 |
| 健康检查 | http://localhost:3003/api/health |

**演示账号：** `admin@axon.demo` / `demo1234`

> 说明：这不是 Google 搜索引擎收录的公开站，而是可在 Chrome 地址栏直接打开的 Web 应用。长期公网域名需部署到云主机后再绑定。

## 工程测试检查清单（已自动化验证）

1. 打开登录页 → 登录  
2. 总览 KPI / 图表  
3. AI 采集 → 建 Case  
4. Case：指派 → 进行中 → 待核验 → 关闭  
5. 任务看板  
6. 证据库导入  
7. 日报生成 + 导出  
8. 报表 Excel 导出  
9. Case 证据 ZIP 下载  

## 本地启动

```bash
cd axon-case
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run build
npx next start -p 3003
```

复制 `.env.example` 为 `.env`。可选配置 `OPENAI_API_KEY`。

## 技术栈

Next.js 15 · TypeScript · Tailwind · Prisma · SQLite · NextAuth · Recharts · OpenAI SDK
