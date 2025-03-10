apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: your-cloud-run-service
  namespace: level-poetry-395302
spec:
  template:
    spec:
      containers:
        - name: your-app-container
          image: your-app-image
          ports:
            - containerPort: 8080
          env:
            - name: INSTANCE_UNIX_SOCKET
              value: /cloudsql/level-poetry-395302:your-region:your-cloudsql-instance/socket # 修改: 指定 socket 文件路径
            - name: DB_USER
              value: your-db-user
            - name: DB_PASS
              value: your-db-password
            - name: DB_NAME
              value: your-db-name
          volumeMounts:  # 添加: 应用容器挂载共享 Volume
            - name: cloudsql-socket
              mountPath: /cloudsql/level-poetry-395302:your-region:your-cloudsql-instance #修改：指定 socket 文件路径
              readOnly: false

        - name: cloud-sql-proxy
          image: gcr.io/cloudsql-proxy/cloud-sql-proxy:latest
          command: ["/cloudsql/cloud_sql_proxy"]
          args: [
            "-instances=level-poetry-395302:your-region:your-cloudsql-instance=tcp:3306",
            "-credential_file=/secrets/cloudsql/credentials.json",
            "-private-ip"
          ]
          securityContext:
            runAsUser: 2
          volumeMounts: # Cloud SQL Proxy 容器挂载共享 Volume
            - name: cloudsql-socket
              mountPath: /cloudsql/level-poetry-395302:your-region:your-cloudsql-instance #修改：指定 socket 文件路径

            - name: cloudsql-oauth-credentials
              mountPath: /secrets/cloudsql
              readOnly: true
      volumes: # 定义共享 Volume
        - name: cloudsql-socket
          emptyDir: {}  # 使用 emptyDir 创建共享 Volume
        - name: cloudsql-oauth-credentials
          secret:
            secretName: cloudsql-oauth-credentials

      vpcAccess:
        network: projects/level-poetry-395302/global/networks/your-vpc-network
        egress: ALL
