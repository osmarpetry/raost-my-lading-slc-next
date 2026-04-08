import { createAppServer } from "./src/server/bootstrap";

async function main() {
  const port = Number(process.env.PORT ?? 3000);
  const hostname = process.env.HOST ?? "0.0.0.0";
  const dev = process.env.NODE_ENV !== "production";

  const appServer = await createAppServer({
    port,
    hostname,
    dev,
    dir: process.cwd(),
  });

  const actualPort = await appServer.start();
  console.log(`[slc-next] listening on http://${hostname}:${actualPort}`);

  const shutdown = async () => {
    await appServer.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main().catch((error) => {
  console.error("[slc-next] failed to boot", error);
  process.exit(1);
});
