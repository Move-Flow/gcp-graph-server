import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import { config } from "dotenv";
import winston from "winston";
import cors from "cors";
import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import { PrismaClient } from "@prisma/client";

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

      // Return error response
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
        version: "1.0.0",
        environment: process.env.NODE_ENV || "development",
      });
    }
  });

  // Start server
  app.listen(port, () => {
    logger.info(`🚀 Server ready at http://localhost:${port}/graphql`);
    logger.info(`Health check available at http://localhost:${port}/health`);
    logger.info(`Default route with DB status at http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
