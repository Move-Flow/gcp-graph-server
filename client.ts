import { ApolloClient, InMemoryCache, gql } from "@apollo/client/core";

const client = new ApolloClient({
  uri: "https://gcp-graph-server-1098432245195.us-central1.run.app/graphql",
  cache: new InMemoryCache(),
});

// 示例查询
const exampleQueries = {
  // 获取类型信息的查询
  introspectionQuery: gql`
    query {
      __schema {
        types {
          name
          description
        }
      }
    }
  `,

  // 你的自定义查询
  customQuery: gql`
    query YourQuery {
      # 替换为你的实际查询
      __typename
    }
  `,
};

// 执行测试
async function runTests() {
  console.log("Testing GraphQL API...\n");

  try {
    // 测试内省查询
    console.log("Testing Introspection Query:");
    const { data: schemaData } = await client.query({
      query: exampleQueries.introspectionQuery,
    });

    if (schemaData) {
      console.log("✅ Schema introspection successful");
      console.log(
        "Available types:",
        schemaData.__schema.types.map((t: any) => t.name).join(", ")
      );
    }

    // 测试自定义查询
    console.log("\nTesting Custom Query:");
    const { data: customData } = await client.query({
      query: exampleQueries.customQuery,
    });

    if (customData) {
      console.log("✅ Custom query successful");
      console.log("Result:", customData);
    }
  } catch (error) {
    console.error("Error during tests:", error);
  }
}

// 运行测试
runTests();
