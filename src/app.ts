import express from "express";
import eventRoutes from "./routes/event.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();
app.use(express.json());

app.use("/api", eventRoutes);

app.use(errorHandler);

export default app;
