import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./lib/prisma";

const app = Fastify({ logger: true });

app.register(cors, {
  origin: true,
});

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", database: "connected" };
});

const start = async () => {
  try {
    await app.listen({ port: 3333, host: "0.0.0.0" });
    console.log("Servidor rodando em http://localhost:3333");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();