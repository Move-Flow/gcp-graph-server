#!/bin/bash

# 设置项目和服务名称
PROJECT_ID="level-poetry-395302"
SERVICE_NAME="gcp-graph-server"
REGION="us-central1"

# 从环境变量或提示用户输入数据库凭据
DB_USER=${DB_USER:-$(read -p "Enter database user: " u; echo $u)}
DB_PASS=${DB_PASS:-$(read -sp "Enter database password: " p; echo $p; echo)}
DB_NAME=${DB_NAME:-$(read -p "Enter database name: " n; echo $n)}
DB_HOST=${DB_HOST:-$(read -p "Enter database host: " h; echo $h)}
DB_PORT=${DB_PORT:-$(read -p "Enter database port [5432]: " port; echo ${port:-5432})}

# 部署到 Cloud Run
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$SERVICE_NAME:latest \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars "DB_USER=${DB_USER}" \
  --set-env-vars "DB_PASS=${DB_PASS}" \
  --set-env-vars "DB_NAME=${DB_NAME}" \
  --set-env-vars "DB_HOST=${DB_HOST}" \
  --set-env-vars "DB_PORT=${DB_PORT}" \
  --set-env-vars "NODE_ENV=production"

echo "Deployment complete!" 