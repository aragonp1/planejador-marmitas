import { useEffect, useMemo, useState } from "react";
import {
  UtensilsCrossed,
  CalendarRange,
  ShoppingCart,
  Plus,
  Trash2,
  Check,
  Sparkles,
} from "lucide-react";
import { api } from "./services/api";
import type { Category, MealPlan, Recipe } from "./services/api";

type Tab = "recipes" | "planner" | "shopping";

const CATEGORY_LABELS: Record<Category, string> = {
  ACOUGUE: "Açougue",
  HORTIFRUTI: "Hortifrúti",
  DESPENSA: "Despensa",
  FRIOS: "Frios",
  OUTROS: "Outros",
};

const CATEGORY_ORDER: Category[] = [
  "ACOUGUE",
  "HORTIFRUTI",
  "FRIOS",
  "DESPENSA",
  "OUTROS",
];

interface DraftIngredient {
  name: string;
  quantityPerPortion: string;
  unit: string;
  category: Category;
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("recipes");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Estado do formulário de Receita
  const [recipeName, setRecipeName] = useState("");
  const [recipeNotes, setRecipeNotes] = useState("");
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([
    { name: "", quantityPerPortion: "", unit: "g", category: "ACOUGUE" },
  ]);
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Estado do Planejador Semanal
  const [planTitle, setPlanTitle] = useState("Marmitas da Semana");
  const [portionsByRecipeId, setPortionsByRecipeId] = useState<
    Record<string, number>
  >({});
  const [creatingPlan, setCreatingPlan] = useState(false);

  function showMessage(type: "success" | "error", text: string) {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((current) => (current?.text === text ? null : current));
    }, 3500);
  }

  async function loadAllData(preferredPlanId?: string) {
    try {
      setLoading(true);
      const [recipesData, plansData] = await Promise.all([
        api.getRecipes(),
        api.getMealPlans(),
      ]);
      setRecipes(recipesData);
      setMealPlans(plansData);

      if (preferredPlanId) {
        setSelectedPlanId(preferredPlanId);
      } else if (plansData.length > 0 && !selectedPlanId) {
        setSelectedPlanId(plansData[0].id);
      }
    } catch (err) {
      console.error(err);
      showMessage(
        "error",
        "Não foi possível conectar ao servidor (http://localhost:3333)."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, []);

  function addIngredientRow() {
    setDraftIngredients((prev) => [
      ...prev,
      { name: "", quantityPerPortion: "", unit: "g", category: "DESPENSA" },
    ]);
  }

  function removeIngredientRow(index: number) {
    setDraftIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateIngredientRow(
    index: number,
    field: keyof DraftIngredient,
    value: string
  ) {
    setDraftIngredients((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  async function handleCreateRecipe(e: React.FormEvent) {
    e.preventDefault();

    const formattedIngredients = draftIngredients
      .map((item) => ({
        name: item.name.trim(),
        quantityPerPortion: Number(item.quantityPerPortion),
        unit: item.unit.trim() || "g",
        category: item.category,
      }))
      .filter(
        (item) => item.name.length > 0 && item.quantityPerPortion > 0
      );

    if (!recipeName.trim() || formattedIngredients.length === 0) {
      showMessage(
        "error",
        "Preencha o nome da receita e pelo menos 1 ingrediente com quantidade maior que zero."
      );
      return;
    }

    try {
      setSavingRecipe(true);
      await api.createRecipe({
        name: recipeName.trim(),
        notes: recipeNotes.trim() || undefined,
        ingredients: formattedIngredients,
      });

      setRecipeName("");
      setRecipeNotes("");
      setDraftIngredients([
        { name: "", quantityPerPortion: "", unit: "g", category: "ACOUGUE" },
      ]);
      await loadAllData();
      showMessage("success", "Receita salva com sucesso!");
    } catch (err) {
      console.error(err);
      showMessage("error", "Erro ao salvar a receita.");
    } finally {
      setSavingRecipe(false);
    }
  }

  async function handleDeleteRecipe(id: string) {
    try {
      await api.deleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      setPortionsByRecipeId((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      showMessage("success", "Receita removida.");
    } catch (err) {
      console.error(err);
      showMessage("error", "Erro ao excluir a receita.");
    }
  }

  function setRecipePortions(recipeId: string, portions: number) {
    setPortionsByRecipeId((prev) => ({
      ...prev,
      [recipeId]: Math.max(0, Math.floor(portions)),
    }));
  }

  async function handleCreateMealPlan(e: React.FormEvent) {
    e.preventDefault();

    const selectedItems = Object.entries(portionsByRecipeId)
      .filter(([, portions]) => portions > 0)
      .map(([recipeId, portions]) => ({ recipeId, portions }));

    if (!planTitle.trim()) {
      showMessage("error", "Dê um nome para o planejamento da semana.");
      return;
    }

    if (selectedItems.length === 0) {
      showMessage(
        "error",
        "Defina pelo menos 1 porção em alguma receita para gerar a lista."
      );
      return;
    }

    try {
      setCreatingPlan(true);
      const createdPlan = await api.createMealPlan({
        title: planTitle.trim(),
        items: selectedItems,
      });

      setPortionsByRecipeId({});
      await loadAllData(createdPlan.id);
      setActiveTab("shopping");
      showMessage("success", "Planejamento criado e lista de compras gerada!");
    } catch (err) {
      console.error(err);
      showMessage("error", "Erro ao gerar o planejamento semanal.");
    } finally {
      setCreatingPlan(false);
    }
  }

  async function handleToggleItem(itemId: string) {
    // Atualização otimista para resposta instantânea ao clicar no mercado
    setMealPlans((prev) =>
      prev.map((plan) =>
        plan.id !== selectedPlan?.id
          ? plan
          : {
              ...plan,
              shopping: plan.shopping.map((item) =>
                item.id === itemId ? { ...item, checked: !item.checked } : item
              ),
            }
      )
    );

    try {
      await api.toggleShoppingItem(itemId);
    } catch (err) {
      console.error(err);
      showMessage("error", "Erro ao atualizar item da lista.");
      await loadAllData(selectedPlan?.id);
    }
  }

  async function handleDeletePlan(planId: string) {
    try {
      await api.deleteMealPlan(planId);
      const remaining = mealPlans.filter((p) => p.id !== planId);
      setMealPlans(remaining);
      setSelectedPlanId(remaining[0]?.id ?? "");
      showMessage("success", "Planejamento excluído.");
    } catch (err) {
      console.error(err);
      showMessage("error", "Erro ao excluir o planejamento.");
    }
  }

  const selectedPlan = useMemo(() => {
    return (
      mealPlans.find((plan) => plan.id === selectedPlanId) ??
      mealPlans[0] ??
      null
    );
  }, [mealPlans, selectedPlanId]);

  const groupedShopping = useMemo(() => {
    if (!selectedPlan) return [];

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: selectedPlan.shopping.filter(
        (item) => item.ingredient.category === category
      ),
    })).filter((group) => group.items.length > 0);
  }, [selectedPlan]);

  const shoppingStats = useMemo(() => {
    if (!selectedPlan) return { total: 0, checked: 0, percent: 0 };
    const total = selectedPlan.shopping.length;
    const checked = selectedPlan.shopping.filter((i) => i.checked).length;
    const percent = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { total, checked, percent };
  }, [selectedPlan]);

  const totalPlannedPortions = useMemo(() => {
    return Object.values(portionsByRecipeId).reduce((acc, n) => acc + n, 0);
  }, [portionsByRecipeId]);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">
              Planejador de Marmitas
            </h1>
            <p className="text-xs text-stone-500">
              Receitas, porções da semana e lista de compras automática
            </p>
          </div>

          {/* Navegação por abas */}
          <nav className="flex rounded-xl bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("recipes")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-initial ${
                activeTab === "recipes"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <UtensilsCrossed className="h-4 w-4" />
              Receitas
              <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-xs text-stone-700">
                {recipes.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("planner")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-initial ${
                activeTab === "planner"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <CalendarRange className="h-4 w-4" />
              Planejar
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("shopping")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:flex-initial ${
                activeTab === "shopping"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <ShoppingCart className="h-4 w-4" />
              Compras
              {shoppingStats.total > 0 && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                  {shoppingStats.checked}/{shoppingStats.total}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mensagem de feedback */}
      {feedback && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback.text}
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
            Carregando dados do banco...
          </div>
        ) : (
          <>
            {/* ABA 1: RECEITAS */}
            {activeTab === "recipes" && (
              <div className="grid gap-6 lg:grid-cols-12">
                {/* Formulário de cadastro */}
                <form
                  onSubmit={handleCreateRecipe}
                  className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs lg:col-span-5"
                >
                  <h2 className="text-base font-semibold text-stone-900">
                    Nova Receita
                  </h2>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-700">
                      Nome da receita
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Frango desfiado com páprica"
                      value={recipeName}
                      onChange={(e) => setRecipeName(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-700">
                      Observações de preparo (opcional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ex: Cozinhar na pressão por 20 min e desfiar"
                      value={recipeNotes}
                      onChange={(e) => setRecipeNotes(e.target.value)}
                      className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-700">
                        Ingredientes (por 1 porção)
                      </span>
                      <button
                        type="button"
                        onClick={addIngredientRow}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar
                      </button>
                    </div>

                    {draftIngredients.map((row, idx) => (
                      <div
                        key={idx}
                        className="space-y-2 rounded-xl border border-stone-200 bg-stone-50 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Ingrediente (ex: Peito de frango)"
                            value={row.name}
                            onChange={(e) =>
                              updateIngredientRow(idx, "name", e.target.value)
                            }
                            className="flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                          />
                          {draftIngredients.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeIngredientRow(idx)}
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                              title="Remover ingrediente"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            placeholder="Qtd"
                            value={row.quantityPerPortion}
                            onChange={(e) =>
                              updateIngredientRow(
                                idx,
                                "quantityPerPortion",
                                e.target.value
                              )
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                          />

                          <input
                            type="text"
                            placeholder="Unid (g, ml, un)"
                            value={row.unit}
                            onChange={(e) =>
                              updateIngredientRow(idx, "unit", e.target.value)
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                          />

                          <select
                            value={row.category}
                            onChange={(e) =>
                              updateIngredientRow(
                                idx,
                                "category",
                                e.target.value as Category
                              )
                            }
                            className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-600 focus:outline-none"
                          >
                            {CATEGORY_ORDER.map((cat) => (
                              <option key={cat} value={cat}>
                                {CATEGORY_LABELS[cat]}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={savingRecipe}
                    className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {savingRecipe ? "Salvando..." : "Salvar Receita"}
                  </button>
                </form>

                {/* Lista de receitas cadastradas */}
                <div className="space-y-3 lg:col-span-7">
                  <h2 className="text-base font-semibold text-stone-900">
                    Receitas Cadastradas
                  </h2>

                  {recipes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
                      Nenhuma receita cadastrada ainda. Crie a primeira ao lado!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recipes.map((recipe) => (
                        <div
                          key={recipe.id}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="font-semibold text-stone-900">
                                {recipe.name}
                              </h3>
                              {recipe.notes && (
                                <p className="mt-0.5 text-xs text-stone-500">
                                  {recipe.notes}
                                </p>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteRecipe(recipe.id)}
                              className="rounded-lg p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Excluir receita"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {recipe.ingredients.map((ri) => (
                              <span
                                key={ri.id}
                                className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-xs text-stone-700"
                              >
                                <span className="font-medium capitalize">
                                  {ri.ingredient.name}
                                </span>
                                <span className="text-stone-500">
                                  ({ri.quantityPerPortion}
                                  {ri.ingredient.unit}/porção)
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 2: PLANEJAR SEMANA */}
            {activeTab === "planner" && (
              <form
                onSubmit={handleCreateMealPlan}
                className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-stone-700">
                      Título do planejamento
                    </label>
                    <input
                      type="text"
                      value={planTitle}
                      onChange={(e) => setPlanTitle(e.target.value)}
                      placeholder="Ex: Marmitas da Semana"
                      className="w-full max-w-md rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="text-sm text-stone-600">
                    Total selecionado:{" "}
                    <span className="font-bold text-emerald-700">
                      {totalPlannedPortions} porções
                    </span>
                  </div>
                </div>

                {recipes.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
                    Cadastre algumas receitas na aba <strong>Receitas</strong>{" "}
                    antes de montar o planejamento.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                    {recipes.map((recipe) => {
                      const currentPortions = portionsByRecipeId[recipe.id] ?? 0;

                      return (
                        <div
                          key={recipe.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <h3 className="font-semibold text-stone-900">
                              {recipe.name}
                            </h3>
                            <p className="text-xs text-stone-500">
                              {recipe.ingredients
                                .map(
                                  (ri) =>
                                    `${ri.ingredient.name} (${ri.quantityPerPortion}${ri.ingredient.unit})`
                                )
                                .join(" • ")}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-500">
                              Porções:
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setRecipePortions(
                                  recipe.id,
                                  currentPortions - 1
                                )
                              }
                              className="h-8 w-8 rounded-lg border border-stone-300 text-sm font-bold text-stone-700 hover:bg-stone-100"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={currentPortions}
                              onChange={(e) =>
                                setRecipePortions(
                                  recipe.id,
                                  Number(e.target.value)
                                )
                              }
                              className="h-8 w-16 rounded-lg border border-stone-300 text-center text-sm font-semibold focus:border-emerald-600 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setRecipePortions(
                                  recipe.id,
                                  currentPortions + 1
                                )
                              }
                              className="h-8 w-8 rounded-lg border border-stone-300 text-sm font-bold text-stone-700 hover:bg-stone-100"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={creatingPlan || recipes.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {creatingPlan
                      ? "Calculando..."
                      : "Gerar Lista de Compras"}
                  </button>
                </div>
              </form>
            )}

            {/* ABA 3: LISTA DE COMPRAS */}
            {activeTab === "shopping" && (
              <div className="space-y-5">
                {!selectedPlan ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
                    Nenhum planejamento criado ainda. Vá até{" "}
                    <strong>Planejar</strong> para gerar sua primeira lista!
                  </div>
                ) : (
                  <>
                    {/* Cabeçalho do planejamento selecionado */}
                    <div className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        {mealPlans.length > 1 ? (
                          <select
                            value={selectedPlan.id}
                            onChange={(e) => setSelectedPlanId(e.target.value)}
                            className="rounded-xl border border-stone-300 px-3 py-1.5 text-sm font-semibold text-stone-900 focus:border-emerald-600 focus:outline-none"
                          >
                            {mealPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <h2 className="text-lg font-bold text-stone-900">
                            {selectedPlan.title}
                          </h2>
                        )}

                        <p className="text-xs text-stone-500">
                          {selectedPlan.items
                            .map((i) => `${i.portions}x ${i.recipe.name}`)
                            .join(" • ")}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-700">
                            {shoppingStats.checked} de {shoppingStats.total}{" "}
                            itens ({shoppingStats.percent}%)
                          </div>
                          <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-stone-200">
                            <div
                              className="h-full bg-emerald-600 transition-all"
                              style={{ width: `${shoppingStats.percent}%` }}
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeletePlan(selectedPlan.id)}
                          className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Excluir planejamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Itens agrupados por categoria */}
                    <div className="grid gap-4 md:grid-cols-2">
                      {groupedShopping.map((group) => (
                        <div
                          key={group.category}
                          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xs"
                        >
                          <h3 className="mb-3 text-xs font-bold tracking-wider text-stone-500 uppercase">
                            {group.label}
                          </h3>

                          <ul className="space-y-2">
                            {group.items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleItem(item.id)}
                                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                                    item.checked
                                      ? "border-emerald-200 bg-emerald-50/60 text-stone-400 line-through"
                                      : "border-stone-200 bg-stone-50/60 text-stone-800 hover:bg-stone-100"
                                  }`}
                                >
                                  <span className="flex items-center gap-2.5">
                                    <span
                                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                                        item.checked
                                          ? "border-emerald-600 bg-emerald-600 text-white"
                                          : "border-stone-300 bg-white"
                                      }`}
                                    >
                                      {item.checked && (
                                        <Check className="h-3.5 w-3.5" />
                                      )}
                                    </span>
                                    <span className="font-medium capitalize">
                                      {item.ingredient.name}
                                    </span>
                                  </span>

                                  <span className="ml-2 shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-stone-700 border border-stone-200 no-underline">
                                    {item.totalQuantity} {item.ingredient.unit}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;