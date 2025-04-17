import express from "express";

const port = process.env.PORT || 3010;
const app = express();


const router = express.Router();




const statusRouter = express.Router();
//TODO fix assert statement
//import VersionJson from "./version.json" assert { type: "json"};
statusRouter.get("/version");


//? 
app.use('/api/v1', router);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

//listen
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
