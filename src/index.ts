import express from "express";
import 'dotenv/config';

import { twitchAuthRouter } from './twitch-utils.js';
import statusRouter from "./utils-router.js";
import authRouter from "./auth-router.js";


//vars
const port = process.env.PORT || 3000;
const app = express();


//MARK: API
const router = express.Router();


//MARK:ROUTERS
app.use('/api/v1', router);
app.use(statusRouter);
app.use(authRouter);
app.use(twitchAuthRouter);


//MARK: LISTEN
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});

