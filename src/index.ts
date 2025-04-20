import express from "express";
import 'dotenv/config';

import statusRouter from "./utils-router.js";
import { authRouter } from "./auth-router.js";
import ApplicationInfoJson from "./version.json" with { type: "json"};

//MARK:SETUP
if (process.env.NODE_ENV === "development")
  console.warn(`[${new Date().toISOString()}] ${ApplicationInfoJson.application.toUpperCase()} is running in DEVELOPMENT mode`);


//vars
const port = process.env.PORT || 3000;
const app = express();


//MARK: API
const router = express.Router();


//MARK:ROUTERS
app.use('/api/v1', router);
app.use(statusRouter);
app.use(authRouter);


//MARK: LISTEN
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

