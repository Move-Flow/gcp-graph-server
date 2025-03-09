#!/bin/bash

# 设置项目和服务名称
PROJECT_ID="level-poetry-395302"
SERVICE_NAME="gcp-graph-server"
REGION="us-central1"
INSTANCE_CONNECTION_NAME="level-poetry-395302:us-central1:moveflow"

# 从环境变量或提示用户输入数据库凭据
DB_USER=${DB_USER:-$(read -p "Enter database user: " u; echo $u)}
DB_PASS=${DB_PASS:-$(read -sp "Enter database password: " p; echo $p; echo)}
DB_NAME=${DB_NAME:-$(read -p "Enter database name: " n; echo $n)}

# 构建 DATABASE_URL
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${INSTANCE_CONNECTION_NAME}"

# 部署到 Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --add-cloudsql-instances $INSTANCE_CONNECTION_NAME \
  --set-env-vars "DATABASE_URL=${DATABASE_URL}" \
  --set-env-vars "DB_USER=${DB_USER}" \
  --set-env-vars "DB_PASS=${DB_PASS}" \
  --set-env-vars "DB_NAME=${DB_NAME}" \
  --set-env-vars "INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME}" \
  --set-env-vars "NODE_ENV=production"

echo "Deployment complete!" 