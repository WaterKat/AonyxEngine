import { Router } from "express";

import ApplicationInfoJson from "./version.json" with { type: "json"};

const statusRouter = Router();

statusRouter.get("/", (req, res) => {
  res.status(200).send(`hello world from ${ApplicationInfoJson.application}!`);
});

statusRouter.get("/version", (req, res) => {
  res.status(200).json(ApplicationInfoJson);
});

statusRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timeStamp: Date.now() });
});

export default statusRouter;
