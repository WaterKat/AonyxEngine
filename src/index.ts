import express from "express";
import 'dotenv/config';

import statusRouter from "./utils-router.js";
import authRouter from "./auth-router.js";


//vars
const port = process.env.PORT || 3010;
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

