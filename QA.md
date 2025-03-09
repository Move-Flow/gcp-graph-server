# Cloud SQL 连接问题排查指南

## 问题描述

当应用程序尝试连接到 Cloud SQL 时出现以下错误：

```json
{
  "status": "error",
  "message": "Server is running but database connection failed",
  "database": {
    "connected": false,
    "error": {
      "message": "\nInvalid `prisma.$queryRaw()` invocation:\n\n\nCan't reach database server at `/cloudsql/level-poetry-395302:us-central1:moveflow:5432`\n\nPlease make sure your database server is running at `/cloudsql/level-poetry-395302:us-central1:moveflow:5432`.",
      "code": "UNKNOWN"
    },
    "connection_string": "postgresql://postgres:****@localhost/blend-point?host=/cloudsql/level-poetry-395302:us-central1:moveflow",
    "instance_name": "level-poetry-395302:us-central1:moveflow"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

## 诊断工具

应用程序内置了诊断工具，可以通过以下端点访问：

- **`/diagnostics`**: 返回 JSON 格式的详细诊断信息
- **`/diagnostics/text`**: 返回格式化的纯文本诊断报告

诊断工具会检查以下方面：

1. **环境信息**：操作系统、Node.js 版本、进程信息
2. **环境变量**：检查关键环境变量是否正确设置
3. **Cloud SQL 连接**：检查 socket 目录和文件是否存在
4. **用户权限**：检查当前运行用户和权限
5. **网络连接**：检查 PostgreSQL 连接状态
6. **问题分析**：自动分析可能的问题并提供建议

## Cloud Run 所需的 IAM 角色

为了使 Cloud Run 服务能够正确连接到 Cloud SQL，需要确保服务账号具有以下角色：

1. **Cloud SQL Client** (`roles/cloudsql.client`)
   - 允许 Cloud Run 服务连接到 Cloud SQL 实例
   - 这是连接 Cloud SQL 的最低要求

2. **Cloud Run 服务账号** (`roles/run.serviceAgent`)
   - 允许 Cloud Run 服务代表用户执行操作
   - 通常自动分配给 Cloud Run 服务

### 如何分配角色

1. 打开 Google Cloud Console
2. 导航到 IAM & Admin > IAM
3. 找到 Cloud Run 服务账号（通常是 `service-PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com`）
4. 点击编辑（铅笔图标）
5. 添加 `Cloud SQL Client` 角色
6. 保存更改

或者使用 gcloud 命令：

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:service-PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com \
  --role=roles/cloudsql.client
```

## 排查步骤

### 1. 检查 Cloud Run 配置

确保 Cloud Run 服务正确配置了 Cloud SQL 连接：

- 打开 Google Cloud Console
- 导航到 Cloud Run 服务
- 选择你的服务
- 点击"编辑和部署新修订版本"
- 在"连接"部分，确保已添加 Cloud SQL 连接
  - 应该有一个条目指向 `level-poetry-395302:us-central1:moveflow`
  - 如果没有，点击"添加 Cloud SQL 连接"并选择你的实例

### 2. 检查 DATABASE_URL 格式

在 Cloud Run 中使用 Cloud SQL 时，正确的连接字符串格式应为：

```
postgresql://USERNAME:PASSWORD@localhost/DATABASE_NAME?host=/cloudsql/INSTANCE_CONNECTION_NAME
```

注意事项：
- 主机部分应该是 `localhost`
- `?host=` 参数指向 Unix socket 路径
- 不要在 socket 路径后添加端口号（如 `:5432`）
- 确保数据库名称在 Cloud SQL 实例中存在

### 3. 检查 IAM 权限

确保 Cloud Run 服务账号有权限连接到 Cloud SQL：

- 打开 Google Cloud Console
- 导航到 IAM & Admin > IAM
- 找到你的 Cloud Run 服务账号
- 确保它有 `Cloud SQL Client` 角色

### 4. 检查 Cloud SQL 实例配置

- 打开 Google Cloud Console
- 导航到 SQL
- 选择你的实例 `moveflow`
- 检查以下内容：
  - 实例是否正在运行
  - 连接设置中是否允许来自 Cloud Run 的连接
  - 数据库 `blend-point` 是否存在
  - 用户 `postgres` 是否存在并有正确的权限

### 5. 检查 Cloud SQL API 是否启用

- 打开 Google Cloud Console
- 导航到 API 和服务 > 库
- 搜索 "Cloud SQL Admin API"
- 确保该 API 已启用

### 6. 检查 Unix Socket 路径

在 Cloud Run 中，Cloud SQL 连接器会在 `/cloudsql/INSTANCE_CONNECTION_NAME` 创建一个 Unix socket。确保：

- 环境变量 `INSTANCE_CONNECTION_NAME` 设置正确
- 不要在 socket 路径后添加端口号（如 `:5432`）

## 常见问题解决方案

### 问题：Socket 路径错误

**症状**：错误消息中包含类似 `/cloudsql/INSTANCE_NAME:5432` 的路径（带有端口号）

**解决方案**：
- 确保 DATABASE_URL 中的 host 参数格式正确：`?host=/cloudsql/INSTANCE_CONNECTION_NAME`
- 不要在 socket 路径后添加端口号

### 问题：IAM 权限不足

**症状**：错误消息提示无法连接到数据库服务器

**解决方案**：
- 确保 Cloud Run 服务账号有 `Cloud SQL Client` 角色
- 如果使用自定义服务账号，确保它有正确的权限

### 问题：Cloud SQL 实例未正确配置

**症状**：无法连接到数据库

**解决方案**：
- 确保 Cloud SQL 实例正在运行
- 确保数据库和用户存在
- 检查用户权限

### 问题：Cloud Run 未正确配置 Cloud SQL 连接

**症状**：无法连接到数据库

**解决方案**：
- 在 Cloud Run 服务配置中添加 Cloud SQL 连接
- 确保连接到正确的实例

### 问题：OpenSSL 依赖缺失

**症状**：错误消息包含 `Prisma cannot find the required 'libssl' system library`

**解决方案**：
- 在 Dockerfile 中添加 OpenSSL 安装：
  ```dockerfile
  RUN apt-get update && apt-get install -y openssl
  ```

## 诊断输出示例

以下是诊断工具的输出示例：

```
=== Cloud SQL 连接诊断报告 ===

时间: 2023-05-09T16:22:30.123Z
环境: production
Node.js 版本: v20.18.3

--- 环境变量 ---
DATABASE_URL: postgresql://postgres:****@localhost/blend-point?host=/cloudsql/level-poetry-395302:us-central1:moveflow
INSTANCE_CONNECTION_NAME: level-poetry-395302:us-central1:moveflow
PORT: 8080

--- Cloud SQL 连接 ---
/cloudsql 目录存在: 是
Socket 路径: /cloudsql/level-poetry-395302:us-central1:moveflow
Socket 目录内容: ["level-poetry-395302:us-central1:moveflow"]
实例 socket 存在: 是
Socket 统计信息: {"is_socket":true,"size":0,"mode":"777","uid":0,"gid":0}

--- 用户信息 ---
用户名: root
ID 信息: uid=0(root) gid=0(root) groups=0(root)

--- 网络连接 ---
PostgreSQL 连接:
No PostgreSQL connections found

--- 问题分析 ---
可能的问题:
- DATABASE_URL 中的 Unix socket 路径包含端口号

建议:
- 移除 Unix socket 路径中的端口号 (:5432)
```

## 参考资料

- [在 Cloud Run 中连接到 Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-run)
- [Prisma 与 Cloud SQL 集成](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-google-cloud-platform)
- [Cloud SQL 连接问题排查](https://cloud.google.com/sql/docs/postgres/troubleshooting)
- [Cloud Run IAM 角色](https://cloud.google.com/run/docs/reference/iam/roles)
- [Cloud SQL IAM 角色](https://cloud.google.com/sql/docs/postgres/iam-roles) 