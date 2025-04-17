import express from "express";

const port = process.env.PORT || 3010;
const app = express();

//MARK: STATUS
import ApplicationInfoJson from "./version.json" with { type: "json"};

const statusRouter = express.Router();

statusRouter.get("/", (req, res) => {
  res.status(200).send(`hello world from ${ApplicationInfoJson.application}!`);
});

statusRouter.get("/version", (req, res) => {
  res.status(200).json(ApplicationInfoJson);
});

statusRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timeStamp: Date.now() });
});

app.use(statusRouter);


//MARK: API
const router = express.Router();

app.use('/api/v1', router);


//MARK: LISTEN
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
