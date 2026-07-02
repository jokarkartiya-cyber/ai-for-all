import { createServer } from "http";
import { app } from "./app";
import { config } from "./config";
import { initDatabase } from "./config/database";
import { migrate } from "./config/schema";
import { logger } from "./utils/logger";

async function start() {
  const dbReady = await initDatabase();
  if (dbReady) {
    await migrate();
  }

  const httpServer = createServer(app);

  httpServer.listen(config.port, () => {
    logger.info(`Backend running on port ${config.port}`, {
      env: config.nodeEnv,
      corsOrigin: config.corsOrigin,
    });
  });
}

start().catch((error) => {
  logger.error("Failed to start server", { error });
  process.exit(1);
});
