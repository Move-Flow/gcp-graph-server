# GCP Graph Server

GraphQL API server running on Google Cloud Run, with PostgreSQL database connection.

## 环境要求

- Node.js 20+
- pnpm
- PostgreSQL

## 配置说明

### 环境变量

需要配置以下环境变量：

```bash
# 服务器配置
PORT=8080                  # 服务器端口
NODE_ENV=production        # 环境模式

# 数据库配置
DB_USER=your-db-user      # 数据库用户名
DB_PASS=your-db-password  # 数据库密码
DB_NAME=your-database-name # 数据库名称
DB_HOST=your-db-host      # 数据库主机地址
DB_PORT=5432              # 数据库端口
```

### 网络配置要求

为确保服务能够正常连接到数据库，需要满足以下网络要求：

1. VPC 网络要求
   - Cloud Run 服务和数据库必须在同一个 VPC 网络中
   - 需要配置 VPC 连接器以允许 Cloud Run 访问 VPC 网络
   - 数据库所在子网必须允许来自 Cloud Run 服务的连接

2. 网络配置检查清单：
   - [ ] 已创建 VPC 网络
   - [ ] 已配置适当的子网
   - [ ] 已创建 VPC 连接器
   - [ ] 已配置防火墙规则允许端口 5432
   - [ ] Cloud Run 服务已配置使用 VPC 连接器
   - [ ] 数据库实例已正确配置网络访问权限

3. 防火墙规则要求：
   - 入站规则：允许 TCP 5432 端口（PostgreSQL）
   - 来源：Cloud Run 服务的 IP 范围
   - 目标：数据库所在子网

4. 网络连接检查：
   - 确保数据库监听的 IP 地址正确
   - 确保数据库配置允许远程连接
   - 验证网络路由是否正确配置

## 本地开发

1. 安装依赖：
```bash
pnpm install
```

2. 创建 `.env` 文件：
```bash
cp .env.example .env
```

3. 修改 `.env` 文件中的配置

4. 启动开发服务器：
```bash
pnpm dev
```

## 部署

使用提供的部署脚本：

```bash
./deploy.sh
```

部署脚本会提示输入必要的配置信息，并自动部署到 Cloud Run。

## API 端点

- GraphQL API: `/graphql`
- 健康检查: `/health`
- 数据库状态: `/`
- 诊断信息: `/diagnostics`
- 文本格式诊断: `/diagnostics/text`

## 故障排查

1. 数据库连接问题
   - 检查数据库主机地址和端口是否正确
   - 确认 VPC 配置是否正确
   - 验证防火墙规则是否允许连接
   - 检查数据库用户名和密码是否正确

2. VPC 连接问题
   - 确认 VPC 连接器状态
   - 检查子网配置
   - 验证防火墙规则
   - 检查网络路由配置
   - 确认 IP 地址范围是否正确配置

3. 权限问题
   - 检查数据库用户权限
   - 确认网络访问权限
   - 验证防火墙规则权限

## 网络架构图

```
+----------------+     +----------------+     +----------------+
|                |     |                |     |                |
|   Cloud Run    +-----+  VPC Network   +-----+   Database    |
|    Service     |     |                |     |               |
|                |     |                |     |               |
+----------------+     +----------------+     +----------------+
        |                                            |
        |                                            |
        +--------------------------------------------+
                    Same VPC Network
```

## 安全建议

1. 网络安全
   - 使用最小权限原则配置防火墙规则
   - 定期审查网络访问日志
   - 限制数据库访问来源
   - 使用安全的 VPC 配置

2. 数据库安全
   - 定期更新数据库密码
   - 使用强密码策略
   - 限制数据库用户权限
   - 启用数据库审计日志

3. 服务配置
   - 使用环境变量存储敏感信息
   - 定期更新依赖包
   - 启用服务日志审计
   - 监控异常访问

## 支持

如有问题，请提交 Issue 或联系维护团队。