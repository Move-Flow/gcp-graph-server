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
import { exec } from "child_process";
import util from "util";

// Promisify exec
const execPromise = util.promisify(exec);

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
  // 返回信息时隐藏密码
  return {
    user: process.env.DB_USER || "unknown",
    database: process.env.DB_NAME || "unknown",
    host: process.env.DB_HOST || "unknown",
    port: process.env.DB_PORT || "5432",
  };
}

// 获取数据库连接字符串（包含密码，仅用于内部连接）
function getDatabaseUrl() {
  return `postgresql://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
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
    introspection: true, // 始终启用内省，允许 Playground 访问
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

  // 添加简单的 webshell 端点（仅用于调试）
  app.post("/debug-shell", async (req, res) => {
    try {
      // 检查是否是生产环境，如果是则禁用此功能
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.ALLOW_DEBUG_SHELL
      ) {
        return res.status(403).json({
          status: "error",
          message: "Debug shell is disabled in production environment",
        });
      }

      const { command } = req.body;

      // 安全检查：禁止某些危险命令
      const forbiddenCommands = ["rm", "mkfs", "dd", ">", "|"];
      if (forbiddenCommands.some((cmd) => command.includes(cmd))) {
        return res.status(400).json({
          status: "error",
          message: "Command contains forbidden operations",
        });
      }

      // 执行命令
      const { stdout, stderr } = await execPromise(command);

      res.status(200).json({
        status: "success",
        result: {
          stdout,
          stderr,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: error.message,
        stderr: error.stderr,
      });
    }
  });

  // 添加文件系统浏览端点
  app.get("/debug-fs", async (req, res) => {
    try {
      // 检查是否是生产环境，如果是则禁用此功能
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.ALLOW_DEBUG_SHELL
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "Debug filesystem browser is disabled in production environment",
        });
      }

      const path = (req.query.path as string) || "/";

      // 执行 ls 命令
      const { stdout } = await execPromise(`ls -la ${path}`);

      res.status(200).json({
        status: "success",
        path,
        listing: stdout,
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: error.message,
        stderr: error.stderr,
      });
    }
  });

  // 添加文件内容查看端点
  app.get("/debug-file", async (req, res) => {
    try {
      // 检查是否是生产环境，如果是则禁用此功能
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.ALLOW_DEBUG_SHELL
      ) {
        return res.status(403).json({
          status: "error",
          message: "Debug file viewer is disabled in production environment",
        });
      }

      const path = req.query.path as string;

      if (!path) {
        return res.status(400).json({
          status: "error",
          message: "Path parameter is required",
        });
      }

      // 执行 cat 命令
      const { stdout } = await execPromise(`cat ${path}`);

      res.status(200).json({
        status: "success",
        path,
        content: stdout,
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: error.message,
        stderr: error.stderr,
      });
    }
  });

  // 添加环境变量查看端点
  app.get("/debug-env", async (req, res) => {
    try {
      // 检查是否是生产环境，如果是则禁用此功能
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.ALLOW_DEBUG_SHELL
      ) {
        return res.status(403).json({
          status: "error",
          message:
            "Debug environment viewer is disabled in production environment",
        });
      }

      // 过滤掉敏感信息
      const safeEnv = { ...process.env };

      // 隐藏密码和密钥
      for (const key in safeEnv) {
        if (
          key.includes("PASS") ||
          key.includes("KEY") ||
          key.includes("SECRET") ||
          key.includes("TOKEN")
        ) {
          safeEnv[key] = "****";
        }
      }

      // 特别处理 DATABASE_URL
      if (safeEnv.DATABASE_URL) {
        safeEnv.DATABASE_URL = safeEnv.DATABASE_URL.replace(
          /:[^:@]+@/,
          ":****@"
        );
      }

      res.status(200).json({
        status: "success",
        environment: safeEnv,
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        message: error.message,
      });
    }
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
    logger.info(
      `Debug shell available at http://localhost:${port}/debug-shell (POST)`
    );
    logger.info(
      `Debug filesystem browser available at http://localhost:${port}/debug-fs?path=/path/to/dir`
    );
    logger.info(
      `Debug file viewer available at http://localhost:${port}/debug-file?path=/path/to/file`
    );
    logger.info(
      `Debug environment viewer available at http://localhost:${port}/debug-env`
    );
  });
}

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
