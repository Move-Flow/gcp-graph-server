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
  }

  type Query {
    dailyPoints(userId: String!, startDate: String, endDate: String): [DailyPoint!]!
    userSummary(userId: String!): UserSummary
    topUsers(limit: Int!, orderBy: String!,orderByDirection: String!): [UserSummary!]!
  }

  type Mutation {
    createDailyPoint(
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
    ): DailyPoint!

    updateUserSummary(
      user_id: String!
      blend_lend: Float!
      blend_borrow: Float!
      yuzu_lend: Float!
      yuzu_borrow: Float!
      blend_point: Float!
      yuzu_point: Float!
    ): UserSummary!
  }
`;
