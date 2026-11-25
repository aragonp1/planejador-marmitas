import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const createMealPlanSchema = z.object({
  title: z.string().min(1, "O título do planejamento é obrigatório"),
  items: z
    .array(
      z.object({
        recipeId: z.string().min(1),
        portions: z.number().int().positive("A quantidade de porções deve ser maior que zero"),
      })
    )
    .min(1, "Selecione pelo menos uma receita"),
});

export async function mealPlanRoutes(app: FastifyInstance) {
  // 1. Criar planejamento semanal e gerar lista de compras automaticamente
  app.post("/meal-plans", async (request, reply) => {
    const parsed = createMealPlanSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        message: "Dados inválidos",
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const { title, items } = parsed.data;

    // Caso o usuário mande a mesma receita duas vezes, soma as porções antes de salvar
    const portionsByRecipe = new Map<string, number>();
    for (const item of items) {
      const current = portionsByRecipe.get(item.recipeId) ?? 0;
      portionsByRecipe.set(item.recipeId, current + item.portions);
    }

    const recipeIds = Array.from(portionsByRecipe.keys());

    // Busca todas as receitas selecionadas no banco com seus ingredientes
    const recipes = await prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      include: {
        ingredients: true,
      },
    });

    if (recipes.length !== recipeIds.length) {
      return reply.status(404).send({
        message: "Uma ou mais receitas informadas não foram encontradas",
      });
    }

    // Calcula e soma a quantidade total de cada ingrediente
    const totalsByIngredient = new Map<string, number>();

    for (const recipe of recipes) {
      const portions = portionsByRecipe.get(recipe.id) ?? 0;

      for (const recipeIngredient of recipe.ingredients) {
        const addedQuantity = recipeIngredient.quantityPerPortion * portions;
        const currentTotal = totalsByIngredient.get(recipeIngredient.ingredientId) ?? 0;
        totalsByIngredient.set(recipeIngredient.ingredientId, currentTotal + addedQuantity);
      }
    }

    // Salva o planejamento, os itens do cardápio e a lista de compras de uma vez
    const mealPlan = await prisma.mealPlan.create({
      data: {
        title: title.trim(),
        items: {
          create: Array.from(portionsByRecipe.entries()).map(([recipeId, portions]) => ({
            recipeId,
            portions,
          })),
        },
        shopping: {
          create: Array.from(totalsByIngredient.entries()).map(([ingredientId, totalQuantity]) => ({
            ingredientId,
            totalQuantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            recipe: true,
          },
        },
        shopping: {
          include: {
            ingredient: true,
          },
          orderBy: {
            ingredient: {
              category: "asc",
            },
          },
        },
      },
    });

    return reply.status(201).send(mealPlan);
  });

  // 2. Listar todos os planejamentos e suas listas de compras
  app.get("/meal-plans", async () => {
    const mealPlans = await prisma.mealPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            recipe: true,
          },
        },
        shopping: {
          include: {
            ingredient: true,
          },
          orderBy: {
            ingredient: {
              category: "asc",
            },
          },
        },
      },
    });

    return mealPlans;
  });

  // 3. Marcar ou desmarcar um item na lista de compras
  app.patch("/shopping-items/:id/toggle", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    const parsedParams = paramsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({ message: "ID inválido" });
    }

    const existing = await prisma.shoppingItem.findUnique({
      where: { id: parsedParams.data.id },
    });

    if (!existing) {
      return reply.status(404).send({ message: "Item não encontrado" });
    }

    const updated = await prisma.shoppingItem.update({
      where: { id: existing.id },
      data: { checked: !existing.checked },
      include: { ingredient: true },
    });

    return updated;
  });
}