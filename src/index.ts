import express from "express";

const port = process.env.PORT || 3010;
const app = express();


const router = express.Router();



app.use('/api/v1',router);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});