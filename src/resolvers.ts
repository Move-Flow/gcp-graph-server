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

    userSummary: async (_: unknown, { userId }: { userId: string }) => {
      const user_id = userId.toLowerCase();
      return prisma.userSummary.findUnique({
        where: { user_id: user_id },
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

  Mutation: {
    createDailyPoint: async (_: unknown, args: DailyPointInput) => {
      const dailyPoint = await prisma.dailyPoint.create({
        data: {
          user_id: args.user_id,
          stake_usd: args.stake_usd,
          debt_usd: args.debt_usd,
          blend_lend: args.blend_lend,
          blend_borrow: args.blend_borrow,
          yuzu_lend: args.yuzu_lend,
          yuzu_borrow: args.yuzu_borrow,
          blend_point: args.blend_point,
          yuzu_point: args.yuzu_point,
          send_date: args.send_date,
        },
      });
      return dailyPoint;
    },

    updateUserSummary: async (_: unknown, args: UserSummaryInput) => {
      return prisma.userSummary.upsert({
        where: { user_id: args.user_id },
        update: {
          blend_lend: args.blend_lend,
          blend_borrow: args.blend_borrow,
          yuzu_lend: args.yuzu_lend,
          yuzu_borrow: args.yuzu_borrow,
          blend_point: args.blend_point,
          yuzu_point: args.yuzu_point,
        },
        create: {
          user_id: args.user_id,
          blend_lend: args.blend_lend,
          blend_borrow: args.blend_borrow,
          yuzu_lend: args.yuzu_lend,
          yuzu_borrow: args.yuzu_borrow,
          blend_point: args.blend_point,
          yuzu_point: args.yuzu_point,
        },
      });
    },
  },
};
