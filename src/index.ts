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

// Initialize Prisma client
const prisma = new PrismaClient();

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

      // Return success response
      res.status(200).json({
        status: "ok",
        message: "Server is running",
        database: {
          connected: true,
          timestamp: result[0].now,
          connection_string: process.env.DATABASE_URL
            ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
            : "Not configured",
          instance_name:
            process.env.INSTANCE_CONNECTION_NAME || "Not configured",
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
          connection_string: process.env.DATABASE_URL
            ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
            : "Not configured",
          instance_name:
            process.env.INSTANCE_CONNECTION_NAME || "Not configured",
        },
        diagnostics: diagnosticInfo,
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    }
  });

  // 添加诊断端点
  app.get("/diagnostics", async (req, res) => {
    try {
      const diagnosticInfo = await diagnoseDatabaseConnection();
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
