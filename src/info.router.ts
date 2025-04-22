import { Router } from "express";
import ApplicationInfoJson from "./version.json" with { type: "json"};


const infoRouter = Router();


infoRouter.get("/", (req, res) => {
  res.status(200).send(`hello world from ${ApplicationInfoJson.application}!`);
});


infoRouter.get("/version", (req, res) => {
  res.status(200).json(ApplicationInfoJson);
});


infoRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timeStamp: Date.now() });
});


export default infoRouter;
