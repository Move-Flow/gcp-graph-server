import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import { config } from "dotenv";
import winston from "winston";
import cors from "cors";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { PrismaClient } from "@prisma/client";
import {
  diagnoseDatabaseConnection,
  formatDiagnosticInfo,
} from "./utils/diagnostics";

// Load environment variables
config();

// Configure logger
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

// 安全地获取数据库连接信息，不直接暴露完整的 DATABASE_URL
function getDatabaseInfo() {
  const isProduction = process.env.NODE_ENV === "production";

  // 在生产环境中，不使用 DATABASE_URL，而是使用单独的环境变量
  if (isProduction) {
    // 修正 connection string 拼接逻辑，确保格式正确
    const connectionString = `postgresql://${
      process.env.DB_USER || "unknown"
    }:${process.env.DB_PASS || "password"}@localhost/${
      process.env.DB_NAME || "unknown"
    }?host=/cloudsql/${process.env.INSTANCE_CONNECTION_NAME || "unknown"}`;

    // 返回信息时隐藏密码
    const maskedConnectionString = connectionString.replace(
      /:[^:@]+@/,
      ":****@"
    );

    return {
      user: process.env.DB_USER || "unknown",
      database: process.env.DB_NAME || "unknown",
      instanceName: process.env.INSTANCE_CONNECTION_NAME || "unknown",
      connectionString: maskedConnectionString,
    };
  } else {
    // 非生产环境，仍然使用 DATABASE_URL 但隐藏密码
    return {
      connectionString: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
        : "Not configured",
      instanceName: process.env.INSTANCE_CONNECTION_NAME || "Not configured",
    };
  }
}

// 获取数据库连接字符串（包含密码，仅用于内部连接）
function getDatabaseUrl() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    // 在生产环境中，使用单独的环境变量构建连接字符串
    return `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@localhost/${process.env.DB_NAME}?host=/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
  } else {
    // 在非生产环境中，使用 DATABASE_URL 环境变量
    return process.env.DATABASE_URL;
  }
}

// Initialize Prisma client with the correct connection string
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

// Log database connection information (without sensitive data)
logger.info(`Database connection info: ${JSON.stringify(getDatabaseInfo())}`);

// Define types for database query result
interface DbTimestamp {
  now: Date;
}

async function startServer() {
  const app = express();
  const port = process.env.PORT || 8080;

  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  // Start Apollo Server
  await server.start();

  // Apply middleware
  app.use(cors());
  app.use(express.json());

  // Apply Apollo middleware
  app.use("/graphql", expressMiddleware(server));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });

  // Default route with database connection test
  app.get("/", async (req, res) => {
    try {
      // Test database connection
      const result = await prisma.$queryRaw<DbTimestamp[]>`SELECT NOW()`;

      // 获取安全的数据库信息
      const dbInfo = getDatabaseInfo();

      // Return success response
      res.status(200).json({
        status: "ok",
        message: "Server is running",
        database: {
          connected: true,
          timestamp: result[0].now,
          ...dbInfo,
        },
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error: any) {
      // Log the error
      logger.error("Database connection error:", error);

      // 运行诊断
      const diagnosticInfo = await diagnoseDatabaseConnection();
      logger.info("Database connection diagnostic:", diagnosticInfo);

      // 格式化诊断信息用于日志
      const formattedDiagnostic = formatDiagnosticInfo(diagnosticInfo);
      logger.info("\n" + formattedDiagnostic);

      // 获取安全的数据库信息
      const dbInfo = getDatabaseInfo();

      // Return error response with diagnostic information
      res.status(500).json({
        status: "error",
        message: "Server is running but database connection failed",
        database: {
          connected: false,
          error: {
            message: error.message || "Unknown error",
            code: error.code || "UNKNOWN",
            stack:
              process.env.NODE_ENV === "production" ? undefined : error.stack,
          },
          ...dbInfo,
        },
        diagnostics:
          process.env.NODE_ENV === "production"
            ? { analysis: diagnosticInfo.analysis } // 生产环境只返回分析结果
            : diagnosticInfo, // 非生产环境返回完整诊断信息
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    }
  });

  // 添加诊断端点
  app.get("/diagnostics", async (req, res) => {
    try {
      const diagnosticInfo = await diagnoseDatabaseConnection();

      // 在生产环境中，过滤掉敏感信息
      if (process.env.NODE_ENV === "production") {
        // 移除或模糊化敏感信息
        if (
          diagnosticInfo.env_variables &&
          diagnosticInfo.env_variables.DATABASE_URL
        ) {
          diagnosticInfo.env_variables.DATABASE_URL =
            diagnosticInfo.env_variables.DATABASE_URL.replace(
              /:[^:@]+@/,
              ":****@"
            );
        }
      }

      res.status(200).json(diagnosticInfo);
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: "Failed to run diagnostics",
        error: {
          message: error.message,
          stack:
            process.env.NODE_ENV === "production" ? undefined : error.stack,
        },
      });
    }
  });

  // 添加文本格式的诊断端点
  app.get("/diagnostics/text", async (req, res) => {
    try {
      const diagnosticInfo = await diagnoseDatabaseConnection();

      // 在生产环境中，过滤掉敏感信息
      if (process.env.NODE_ENV === "production") {
        // 移除或模糊化敏感信息
        if (
          diagnosticInfo.env_variables &&
          diagnosticInfo.env_variables.DATABASE_URL
        ) {
          diagnosticInfo.env_variables.DATABASE_URL =
            diagnosticInfo.env_variables.DATABASE_URL.replace(
              /:[^:@]+@/,
              ":****@"
            );
        }
      }

      const formattedOutput = formatDiagnosticInfo(diagnosticInfo);
      res.setHeader("Content-Type", "text/plain");
      res.status(200).send(formattedOutput);
    } catch (error: any) {
      res.status(500).send(`Error running diagnostics: ${error.message}`);
    }
  });

  // Start server
  app.listen(port, () => {
    logger.info(`🚀 Server ready at http://localhost:${port}/graphql`);
    logger.info(`Health check available at http://localhost:${port}/health`);
    logger.info(`Default route with DB status at http://localhost:${port}/`);
    logger.info(
      `Diagnostics available at http://localhost:${port}/diagnostics`
    );
    logger.info(
      `Text diagnostics available at http://localhost:${port}/diagnostics/text`
    );
  });
}

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
