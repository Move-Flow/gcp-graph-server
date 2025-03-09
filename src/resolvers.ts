import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const resolvers = {
  Query: {
    dailyPoints: async (_, { userId, startDate, endDate }) => {
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

    userSummary: async (_, { userId }) => {
      return prisma.userSummary.findUnique({
        where: { user_id: userId },
      });
    },

    topUsers: async (_, { limit, orderBy }) => {
      const orderField = orderBy === "BLEND" ? "blend_point" : "yuzu_point";
      return prisma.userSummary.findMany({
        take: limit,
        orderBy: { [orderField]: "desc" },
      });
    },
  },

  Mutation: {
    createDailyPoint: async (_, args) => {
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

    updateUserSummary: async (_, args) => {
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
