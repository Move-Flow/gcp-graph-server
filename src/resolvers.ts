import { prisma } from "./utils/loader.js";

interface DailyPointInput {
  user_id: string;
  stake_usd: number;
  debt_usd: number;
  blend_lend: number;
  blend_borrow: number;
  yuzu_lend: number;
  yuzu_borrow: number;
  blend_point: number;
  yuzu_point: number;
  send_date: string;
}

interface UserSummaryInput {
  user_id: string;
  blend_lend: number;
  blend_borrow: number;
  yuzu_lend: number;
  yuzu_borrow: number;
  blend_point: number;
  yuzu_point: number;
}

export const resolvers = {
  Query: {
    dailyPoints: async (
      _: unknown,
      {
        userId,
        startDate,
        endDate,
      }: { userId: string; startDate?: string; endDate?: string }
    ) => {
      const where: any = { user_id: userId };
      if (startDate && endDate) {
        where.send_date = {
          gte: startDate,
          lte: endDate,
        };
      }
      return prisma.dailyPoint.findMany({
        where,
        orderBy: { send_date: "desc" },
      });
    },

    dailyPointByDate: async () => {
      const results = await prisma.dailyPoint.groupBy({
        by: ["send_date"],
        _sum: {
          blend_point: true,
          yuzu_point: true,
          stake_usd: true,
          debt_usd: true,
          blend_lend: true,
          blend_borrow: true,
          yuzu_lend: true,
          yuzu_borrow: true,
        },
        _count: {
          user_id: true,
        },
        orderBy: {
          send_date: "desc",
        },
      });

      return results.map((result) => ({
        send_date: result.send_date,
        total_blend_point: result._sum.blend_point || 0,
        total_yuzu_point: result._sum.yuzu_point || 0,
        total_stake_usd: result._sum.stake_usd || 0,
        total_debt_usd: result._sum.debt_usd || 0,
        total_blend_lend: result._sum.blend_lend || 0,
        total_blend_borrow: result._sum.blend_borrow || 0,
        total_yuzu_lend: result._sum.yuzu_lend || 0,
        total_yuzu_borrow: result._sum.yuzu_borrow || 0,
        daily_count: result._count.user_id,
      }));
    },

    pointSummary: async () => {
      const result = await prisma.userSummary.aggregate({
        _sum: {
          blend_point: true,
          yuzu_point: true,
          blend_lend: true,
          blend_borrow: true,
          yuzu_lend: true,
          yuzu_borrow: true,
        },
      });

      return {
        blend_point: result._sum.blend_point || 0,
        yuzu_point: result._sum.yuzu_point || 0,
        blend_lend: result._sum.blend_lend || 0,
        blend_borrow: result._sum.blend_borrow || 0,
        yuzu_lend: result._sum.yuzu_lend || 0,
        yuzu_borrow: result._sum.yuzu_borrow || 0,
      };
    },

    userSummary: async (_: unknown, { userId }: { userId: string }) => {
      const user_id = userId.toLowerCase();
      return prisma.userSummary.findUnique({
        where: { user_id: user_id },
      });
    },

    lastSendPoint: async (_: any, { userId }: { userId?: string }) => {
      const where = userId ? { user_id: userId } : undefined;

      return prisma.dailyPoint.findFirst({
        where,
        orderBy: {
          last_time: "desc",
        },
      });
    },

    topUsers: async (
      _: unknown,
      {
        limit,
        orderBy,
        orderByDirection,
      }: { limit: number; orderBy: string; orderByDirection: string }
    ) => {
      return prisma.userSummary.findMany({
        take: limit,
        orderBy: { [orderBy]: orderByDirection },
      });
    },
  },
};
