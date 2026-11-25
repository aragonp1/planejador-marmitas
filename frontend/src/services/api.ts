const API_URL = "http://localhost:3333";

export type Category =
  | "ACOUGUE"
  | "HORTIFRUTI"
  | "DESPENSA"
  | "FRIOS"
  | "OUTROS";

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  category: Category;
}

export interface RecipeIngredient {
  id: string;
  quantityPerPortion: number;
  ingredient: Ingredient;
}

export interface Recipe {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  ingredients: RecipeIngredient[];
}

export interface MealPlanItem {
  id: string;
  portions: number;
  recipe: Recipe;
}

export interface ShoppingItem {
  id: string;
  totalQuantity: number;
  checked: boolean;
  ingredient: Ingredient;
}

export interface MealPlan {
  id: string;
  title: string;
  createdAt: string;
  items: MealPlanItem[];
  shopping: ShoppingItem[];
}

export const api = {
  async getRecipes(): Promise<Recipe[]> {
    const res = await fetch(`${API_URL}/recipes`);
    if (!res.ok) throw new Error("Erro ao buscar receitas");
    return res.json();
  },

  async createRecipe(data: {
    name: string;
    notes?: string;
    ingredients: {
      name: string;
      unit: string;
      category: Category;
      quantityPerPortion: number;
    }[];
  }): Promise<Recipe> {
    const res = await fetch(`${API_URL}/recipes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao criar receita");
    return res.json();
  },

  async deleteRecipe(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/recipes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Erro ao excluir receita");
  },

  async getMealPlans(): Promise<MealPlan[]> {
    const res = await fetch(`${API_URL}/meal-plans`);
    if (!res.ok) throw new Error("Erro ao buscar planejamentos");
    return res.json();
  },

  async createMealPlan(data: {
    title: string;
    items: { recipeId: string; portions: number }[];
  }): Promise<MealPlan> {
    const res = await fetch(`${API_URL}/meal-plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Erro ao gerar planejamento");
    return res.json();
  },

  async toggleShoppingItem(id: string): Promise<ShoppingItem> {
    const res = await fetch(`${API_URL}/shopping-items/${id}/toggle`, {
      method: "PATCH",
    });
    if (!res.ok) throw new Error("Erro ao atualizar item");
    return res.json();
  },

  async deleteMealPlan(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/meal-plans/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Erro ao excluir planejamento");
  },
};