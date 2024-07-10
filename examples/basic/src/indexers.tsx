import { indexer } from "azure-ai-search-orm";
import { realEstate } from "./indexes";

export const realEstateIndexer = indexer("real-estate-indexer", {
  dataSourceName: "realestate-us-sample",
  targetIndex: realEstate,
});
