import { DefaultAzureCredential } from "@azure/identity";
// import { defineConfig } from "./src/index";

// export default defineConfig({
//   endpoint: "hello, world!",
//   credential: new DefaultAzureCredential(),
// });

export default {
  endpoint: "https://srch-atlas-dev-eastus-001.search.windows.net",
  credential: new DefaultAzureCredential(),
  schema: "src/schema.ts",
};
