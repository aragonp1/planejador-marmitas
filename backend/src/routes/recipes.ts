import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createRecipeSchema = z.object({
  name: z.string().min(1, "O nome da receita é obrigatório"),
  notes: z.string().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1, "O nome do ingrediente é obrigatório"),
        unit: z.string().min(1, "A unidade é obrigatória"), // ex: "g", "ml", "un"
        category: z
          .enum(["ACOUGUE", "HORTIFRUTI", "DESPENSA", "FRIOS", "OUTROS"])
          .default("DESPENSA"),
        quantityPerPortion: z.number().positive("A quantidade deve ser maior que zero"),
      })
    )
    .min(1, "Adicione pelo menos um ingrediente"),
});

export async function recipeRoutes(app: FastifyInstance) {
  // Cadastrar uma nova receita com seus ingredientes
  app.post("/recipes", async (request, reply) => {
    const parsed = createRecipeSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Dados inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, notes, ingredients } = parsed.data;

    const recipe = await prisma.recipe.create({
      data: {
        name: name.trim(),
        notes: notes?.trim(),
        ingredients: {
          create: ingredients.map((item) => {
            const normalizedName = item.name.trim().toLowerCase();

            return {
              quantityPerPortion: item.quantityPerPortion,
              ingredient: {
                connectOrCreate: {
                  where: { name: normalizedName },
                  create: {
                    name: normalizedName,
                    unit: item.unit.trim().toLowerCase(),
                    category: item.category,
                  },
                },
              },
            };
          }),
        },
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return reply.status(201).send(recipe);
  });

  // Listar todas as receitas cadastradas com seus ingredientes
  app.get("/recipes", async () => {
    const recipes = await prisma.recipe.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return recipes;
  });
  // Editar uma receita existente e atualizar seus ingredientes
  app.put("/recipes/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ message: "ID inválido" });
    }

    const parsedBody = createRecipeSchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        message: "Dados inválidos",
        errors: parsedBody.error.flatten().fieldErrors,
      });
    }

    const existing = await prisma.recipe.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!existing) {
      return reply.status(404).send({ message: "Receita não encontrada" });
    }

    const { name, notes, ingredients } = parsedBody.data;

    // Atualiza nome/notas e recria os vínculos de ingredientes com os valores novos
    const updatedRecipe = await prisma.recipe.update({
      where: { id: existing.id },
      data: {
        name: name.trim(),
        notes: notes?.trim() ?? null,
        ingredients: {
          deleteMany: {},
          create: ingredients.map((item) => {
            const normalizedName = item.name.trim().toLowerCase();

            return {
              quantityPerPortion: item.quantityPerPortion,
              ingredient: {
                connectOrCreate: {
                  where: { name: normalizedName },
                  create: {
                    name: normalizedName,
                    unit: item.unit.trim().toLowerCase(),
                    category: item.category,
                  },
                },
              },
            };
          }),
        },
      },
      include: {
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return updatedRecipe;
  });

  // Excluir uma receita
  app.delete("/recipes/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ message: "ID inválido" });
    }

    const existing = await prisma.recipe.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!existing) {
      return reply.status(404).send({ message: "Receita não encontrada" });
    }

    await prisma.recipe.delete({
      where: { id: existing.id },
    });

    return reply.status(204).send();
  });


  // 4. Excluir um planejamento semanal (e sua lista de compras vinculada)
  app.delete("/meal-plans/:id", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ message: "ID inválido" });
    }

    const existing = await prisma.mealPlan.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!existing) {
      return reply.status(404).send({ message: "Planejamento não encontrado" });
    }

    await prisma.mealPlan.delete({
      where: { id: existing.id },
    });

    return reply.status(204).send();
  }); 
}



  
  