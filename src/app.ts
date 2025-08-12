import express from "express";
import eventRoutes from "./routes/event.routes";
import { errorHandler } from "./middlewares/error.middleware";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";
import path from "path";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes and origins during development

const swaggerDocument = YAML.load(path.join(__dirname, "../swagger.yaml"));

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));


app.use("/api", eventRoutes);

app.use(errorHandler);

export default app;
