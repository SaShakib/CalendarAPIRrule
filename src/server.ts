import app from "./app";
import { connectDB } from "./config/db.config";
import { env } from "./config/env.config";

(async () => {
  await connectDB(env.MONGO_URI);
  app.listen(env.PORT, () => console.log(`Server listening on ${env.PORT}`));
})();
