import "dotenv/config";
import express from "express";
import cors from "cors";
import { srch } from "../search";

const app = express();

const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

app.get("/listings", async (_req, res) => {
  const { results } = await srch.realEstate.search(undefined, { top: 10 });

  const listings = [];

  for await (const result of results) {
    listings.push(result.document);
  }

  res.json(listings);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
