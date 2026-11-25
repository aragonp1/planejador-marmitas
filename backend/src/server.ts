import Fastify from "fastify";
import cors from "@fastify/cors";
import { prisma } from "./lib/prisma";
import { recipeRoutes } from "./routes/recipes";
import { mealPlanRoutes } from "./routes/meal-plans";

const app = Fastify({ logger: true });

app.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});

app.get("/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: "ok", database: "connected" };
});

app.register(recipeRoutes);
app.register(mealPlanRoutes);

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