import fs from "fs";
import { exec } from "child_process";
import util from "util";
import os from "os";

const execPromise = util.promisify(exec);

/**
 * 详细诊断 Cloud SQL 连接问题
 * @returns 包含诊断信息的对象
 */
export async function diagnoseDatabaseConnection() {
  const diagnosticInfo: any = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "unknown",
    platform: {
      os: os.platform(),
      release: os.release(),
      type: os.type(),
    },
    node_version: process.version,
    process: {
      pid: process.pid,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
    },
    env_variables: {
      DATABASE_URL: process.env.DATABASE_URL
        ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
        : "Not set",
      INSTANCE_CONNECTION_NAME:
        process.env.INSTANCE_CONNECTION_NAME || "Not set",
      PORT: process.env.PORT || "Not set",
    },
    cloud_sql: {
      socket_dir_exists: fs.existsSync("/cloudsql"),
      socket_path: process.env.INSTANCE_CONNECTION_NAME
        ? `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`
        : "Unknown",
    },
  };

  // 检查 socket 目录
  if (diagnosticInfo.cloud_sql.socket_dir_exists) {
    try {
      const socketDirContents = fs.readdirSync("/cloudsql");
      diagnosticInfo.cloud_sql.socket_dir_contents = socketDirContents;

      // 检查实例 socket 是否存在
      if (process.env.INSTANCE_CONNECTION_NAME) {
        const instanceSocketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
        diagnosticInfo.cloud_sql.instance_socket_exists =
          fs.existsSync(instanceSocketPath);

        if (diagnosticInfo.cloud_sql.instance_socket_exists) {
          try {
            const socketStats = fs.statSync(instanceSocketPath);
            diagnosticInfo.cloud_sql.socket_stats = {
              is_socket: socketStats.isSocket(),
              size: socketStats.size,
              mode: socketStats.mode.toString(8),
              uid: socketStats.uid,
              gid: socketStats.gid,
            };
          } catch (error: any) {
            diagnosticInfo.cloud_sql.socket_stats_error = error.message;
          }
        }
      }
    } catch (error: any) {
      diagnosticInfo.cloud_sql.socket_dir_error = error.message;
    }
  }

  // 检查网络连接
  try {
    const { stdout: netstatOutput } = await execPromise(
      'netstat -an | grep 5432 || echo "No PostgreSQL connections found"'
    );
    diagnosticInfo.network = {
      postgres_connections: netstatOutput.trim().split("\n"),
    };
  } catch (error: any) {
    diagnosticInfo.network = {
      error: error.message,
    };
  }

  // 检查当前用户和权限
  try {
    const { stdout: whoamiOutput } = await execPromise("whoami");
    const { stdout: idOutput } = await execPromise("id");
    diagnosticInfo.user = {
      username: whoamiOutput.trim(),
      id_info: idOutput.trim(),
    };
  } catch (error: any) {
    diagnosticInfo.user = {
      error: error.message,
    };
  }

  // 检查 DNS 解析
  if (process.env.DATABASE_URL) {
    const dbUrlMatch = process.env.DATABASE_URL.match(/@([^:/?]+)/);
    if (dbUrlMatch && dbUrlMatch[1] && dbUrlMatch[1] !== "localhost") {
      try {
        const { stdout: digOutput } = await execPromise(
          `dig ${dbUrlMatch[1]} +short || echo "DNS lookup failed"`
        );
        diagnosticInfo.dns = {
          host: dbUrlMatch[1],
          resolved_ips: digOutput.trim().split("\n"),
        };
      } catch (error: any) {
        diagnosticInfo.dns = {
          error: error.message,
        };
      }
    }
  }

  // 分析连接问题并提供建议
  diagnosticInfo.analysis = analyzeConnectionIssues(diagnosticInfo);

  return diagnosticInfo;
}

/**
 * 分析连接问题并提供建议
 * @param info 诊断信息
 * @returns 分析结果和建议
 */
function analyzeConnectionIssues(info: any) {
  const analysis = {
    possible_issues: [] as string[],
    recommendations: [] as string[],
  };

  // 检查环境变量
  if (
    !info.env_variables.DATABASE_URL ||
    info.env_variables.DATABASE_URL === "Not set"
  ) {
    analysis.possible_issues.push("DATABASE_URL 环境变量未设置");
    analysis.recommendations.push("设置 DATABASE_URL 环境变量");
  } else if (
    info.env_variables.DATABASE_URL.includes(":5432") &&
    info.env_variables.DATABASE_URL.includes("/cloudsql")
  ) {
    analysis.possible_issues.push(
      "DATABASE_URL 中的 Unix socket 路径包含端口号"
    );
    analysis.recommendations.push("移除 Unix socket 路径中的端口号 (:5432)");
  }

  if (
    !info.env_variables.INSTANCE_CONNECTION_NAME ||
    info.env_variables.INSTANCE_CONNECTION_NAME === "Not set"
  ) {
    analysis.possible_issues.push("INSTANCE_CONNECTION_NAME 环境变量未设置");
    analysis.recommendations.push("设置 INSTANCE_CONNECTION_NAME 环境变量");
  }

  // 检查 socket 目录
  if (!info.cloud_sql.socket_dir_exists) {
    analysis.possible_issues.push("/cloudsql 目录不存在");
    analysis.recommendations.push(
      "确保在 Cloud Run 配置中添加了 Cloud SQL 连接"
    );
  } else if (
    info.cloud_sql.socket_dir_contents &&
    info.cloud_sql.socket_dir_contents.length === 0
  ) {
    analysis.possible_issues.push("/cloudsql 目录为空");
    analysis.recommendations.push(
      "检查 Cloud Run 服务账号是否有 Cloud SQL Client 角色"
    );
  }

  // 检查实例 socket
  if (info.cloud_sql.instance_socket_exists === false) {
    analysis.possible_issues.push("实例 socket 文件不存在");
    analysis.recommendations.push(
      "检查实例名称是否正确，以及 Cloud Run 服务账号是否有权限"
    );
  } else if (
    info.cloud_sql.socket_stats &&
    !info.cloud_sql.socket_stats.is_socket
  ) {
    analysis.possible_issues.push("实例 socket 文件存在但不是有效的 socket");
    analysis.recommendations.push("检查 Cloud SQL 实例状态和连接配置");
  }

  // 如果没有发现明显问题，提供一般建议
  if (analysis.possible_issues.length === 0) {
    analysis.possible_issues.push("未发现明显配置问题");
    analysis.recommendations.push("检查 Cloud SQL 实例是否正在运行");
    analysis.recommendations.push("确认数据库用户名和密码是否正确");
    analysis.recommendations.push("验证数据库名称是否存在");
    analysis.recommendations.push("检查 Cloud SQL 实例的防火墙规则");
  }

  return analysis;
}

/**
 * 格式化诊断信息为可读的字符串
 * @param diagnosticInfo 诊断信息对象
 * @returns 格式化后的字符串
 */
export function formatDiagnosticInfo(diagnosticInfo: any): string {
  let output = "=== Cloud SQL 连接诊断报告 ===\n\n";

  output += `时间: ${diagnosticInfo.timestamp}\n`;
  output += `环境: ${diagnosticInfo.environment}\n`;
  output += `Node.js 版本: ${diagnosticInfo.node_version}\n\n`;

  output += "--- 环境变量 ---\n";
  for (const [key, value] of Object.entries(diagnosticInfo.env_variables)) {
    output += `${key}: ${value}\n`;
  }

  output += "\n--- Cloud SQL 连接 ---\n";
  output += `/cloudsql 目录存在: ${
    diagnosticInfo.cloud_sql.socket_dir_exists ? "是" : "否"
  }\n`;
  output += `Socket 路径: ${diagnosticInfo.cloud_sql.socket_path}\n`;

  if (diagnosticInfo.cloud_sql.socket_dir_exists) {
    output += `Socket 目录内容: ${JSON.stringify(
      diagnosticInfo.cloud_sql.socket_dir_contents
    )}\n`;

    if (diagnosticInfo.cloud_sql.instance_socket_exists !== undefined) {
      output += `实例 socket 存在: ${
        diagnosticInfo.cloud_sql.instance_socket_exists ? "是" : "否"
      }\n`;

      if (diagnosticInfo.cloud_sql.socket_stats) {
        output += `Socket 统计信息: ${JSON.stringify(
          diagnosticInfo.cloud_sql.socket_stats
        )}\n`;
      }
    }
  }

  if (diagnosticInfo.user) {
    output += "\n--- 用户信息 ---\n";
    output += `用户名: ${diagnosticInfo.user.username || "Unknown"}\n`;
    output += `ID 信息: ${diagnosticInfo.user.id_info || "Unknown"}\n`;
  }

  if (diagnosticInfo.network) {
    output += "\n--- 网络连接 ---\n";
    if (diagnosticInfo.network.postgres_connections) {
      output += `PostgreSQL 连接:\n${diagnosticInfo.network.postgres_connections.join(
        "\n"
      )}\n`;
    } else if (diagnosticInfo.network.error) {
      output += `获取网络信息错误: ${diagnosticInfo.network.error}\n`;
    }
  }

  output += "\n--- 问题分析 ---\n";
  output += "可能的问题:\n";
  diagnosticInfo.analysis.possible_issues.forEach((issue: string) => {
    output += `- ${issue}\n`;
  });

  output += "\n建议:\n";
  diagnosticInfo.analysis.recommendations.forEach((recommendation: string) => {
    output += `- ${recommendation}\n`;
  });

  return output;
}
