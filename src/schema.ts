export const typeDefs = `#graphql
  type DailyPoint {
    id: Int!
    user_id: String!
    stake_usd: Float!
    debt_usd: Float!
    blend_lend: Float!
    blend_borrow: Float!
    yuzu_lend: Float!
    yuzu_borrow: Float!
    blend_point: Float!
    yuzu_point: Float!
    send_date: String!
    last_time: String!
  }

  type UserSummary {
    id: Int!
    user_id: String!
    blend_lend: Float!
    blend_borrow: Float!
    yuzu_lend: Float!
    yuzu_borrow: Float!
    blend_point: Float!
    yuzu_point: Float!
    last_time: String!
    rank: Int
  }

  type PointSummary {
    blend_point: Float
    yuzu_point: Float
    blend_lend: Float
    blend_borrow: Float
    yuzu_lend: Float
    yuzu_borrow: Float
  }

  type DailyPointByDate {
    send_date: String!
    count: Int!
  }

  type DailyPointSummary {
    send_date: String!
    total_blend_point: Float!
    total_yuzu_point: Float!
    total_stake_usd: Float!
    total_debt_usd: Float!
    total_blend_lend: Float!
    total_blend_borrow: Float!
    total_yuzu_lend: Float!
    total_yuzu_borrow: Float!
    daily_count: Int!
  }

  type Query {
    lastSendPoint(userId: String): DailyPoint
    dailyPoints(userId: String!, startDate: String, endDate: String): [DailyPoint!]!
    dailyPointByDate: [DailyPointSummary!]!
    userSummary(userId: String!): UserSummary
    topUsers(limit: Int!, orderBy: String!,orderByDirection: String!): [UserSummary!]!
    pointSummary: PointSummary
  }

`;
