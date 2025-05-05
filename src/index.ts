import 'dotenv/config';
import express from "express";

import infoRouter from "./info.router.js";
import { authRouter } from "./auth.router.js";
import ApplicationInfoJson from "./version.json" with { type: "json"};
import { getRequiredEnvKeys } from './lib/requireEnvAs.utils.js';

//MARK:SETUP
if (isDev())
{
  console.warn(`[${new Date().toISOString()}] ${ApplicationInfoJson.application.toUpperCase()} is running in DEVELOPMENT mode`);
  setTimeout(() => {
    console.warn(`[${new Date().toISOString()}] ${ApplicationInfoJson.application.toUpperCase()} requires following environment variables:\n${getRequiredEnvKeys().join('=\n')}=\n`);
  }, 1000);
}


//vars
const port = +process.env.PORT || 3000;
const host = process.env.NODE_ENV === 'development' ? '127.0.0.1' : process.env.HOST ?? '0.0.0.0';
const app = express();


//MARK: API
const router = express.Router();


//MARK:ROUTERS
app.use('/api/v1', router);
app.use(infoRouter);
app.use(authRouter);


//MARK: LISTEN
app.listen(port, host, () => {
  console.log(`listening on host ${host} port ${port}`);
});

