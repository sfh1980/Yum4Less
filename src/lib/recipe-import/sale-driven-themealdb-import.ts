import { getDbPool } from "@/lib/db";
import { IngredientNormalizationService } from "@/lib/recipe-import/ingredient-normalization";
import { getOnSaleCatalogIngredientIds } from "@/lib/recipe-import/sale-ingredient-query";
import {
  estimateThemealdbCookTimeMinutes,
  inferThemealdbDifficulty,
  parseThemealdbIngredientLines,
  parseThemealdbInstructions,
  parseThemealdbTags,
  slugifyThemealdbRecipeId,
  ThemealdbClient,
  type ThemealdbFetchFn,
} from "@/lib/recipe-import/themealdb-client";
import {
  DEFAULT_THEMEALDB_IMPORT_MAX_PER_RUN,
  MIN_MAPPABLE_LINE_RATIO,
  MIN_SALE_INGREDIENT_MATCHES,
  THEMEALDB_SOURCE_NAME,
  type ThemealdbImportReport,
  type ThemealdbImportSkipReason,
} from "@/lib/recipe-import/themealdb-types";

export type SaleDrivenThemealdbImportOptions = {
  maxPerRun?: number;
  fetchFn?: ThemealdbFetchFn;
  apiKey?: string;
};

type CandidateMeal = {
  idMeal: string;
  strMeal: string;
  saleOverlapCount: number;
};

export async function runSaleDrivenThemealdbImport(
  options: SaleDrivenThemealdbImportOptions = {},
): Promise<ThemealdbImportReport> {
  const maxPerRun =
    options.maxPerRun ??
    Number(process.env.THEMEALDB_IMPORT_MAX_PER_RUN ?? DEFAULT_THEMEALDB_IMPORT_MAX_PER_RUN);

  const report: ThemealdbImportReport = {
    saleIngredientCount: 0,
    apiFilterCalls: 0,
    candidateMealCount: 0,
    importedCount: 0,
    skipped: [],
    imported: [],
    aliasSavedCount: 0,
    newIngredientCount: 0,
  };

  const saleIngredients = await getOnSaleCatalogIngredientIds();
  report.saleIngredientCount = saleIngredients.length;

  if (saleIngredients.length === 0) {
    return report;
  }

  const normalizer = await IngredientNormalizationService.create();
  const client = new ThemealdbClient({
    apiKey: options.apiKey,
    fetchFn: options.fetchFn,
  });

  const mealSaleHits = new Map<string, { strMeal: string; saleOverlapCount: number }>();

  for (const saleIngredient of saleIngredients) {
    const filterTerm = normalizer.getFilterTermForIngredientId(
      saleIngredient.ingredientId,
    );
    report.apiFilterCalls += 1;

    const filterResponse = await client.filterByIngredient(filterTerm);
    const meals = filterResponse.meals ?? [];

    for (const meal of meals) {
      const existing = mealSaleHits.get(meal.idMeal);
      if (existing) {
        existing.saleOverlapCount += 1;
      } else {
        mealSaleHits.set(meal.idMeal, {
          strMeal: meal.strMeal,
          saleOverlapCount: 1,
        });
      }
    }
  }

  const candidates: CandidateMeal[] = [...mealSaleHits.entries()]
    .map(([idMeal, value]) => ({
      idMeal,
      strMeal: value.strMeal,
      saleOverlapCount: value.saleOverlapCount,
    }))
    .filter((meal) => meal.saleOverlapCount >= MIN_SALE_INGREDIENT_MATCHES)
    .sort((left, right) => right.saleOverlapCount - left.saleOverlapCount);

  report.candidateMealCount = candidates.length;

  const existingIds = await loadExistingThemealdbRecipeIds();
  let importedThisRun = 0;

  for (const candidate of candidates) {
    if (importedThisRun >= maxPerRun) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "cap-reached",
      });
      continue;
    }

    if (existingIds.has(candidate.idMeal)) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "duplicate",
      });
      continue;
    }

    const lookup = await client.lookupMeal(candidate.idMeal);
    const meal = lookup.meals?.[0];
    if (!meal) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "lookup-failed",
      });
      continue;
    }

    const parsedLines = parseThemealdbIngredientLines(meal);
    if (parsedLines.length === 0) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "no-ingredients",
      });
      continue;
    }

    const mappedLines: Array<{
      ingredientId: string;
      displayName: string;
      quantityNote: string;
      matchConfidence: number;
    }> = [];

    for (const line of parsedLines) {
      const outcome = await normalizer.normalizeThemealdbLabel(line.displayName);
      if (outcome.status === "skipped") {
        continue;
      }

      mappedLines.push({
        ingredientId: outcome.ingredientId,
        displayName: line.displayName,
        quantityNote: line.measure || "as needed",
        matchConfidence: outcome.matchConfidence,
      });
    }

    const mappableRatio = mappedLines.length / parsedLines.length;
    if (mappableRatio < MIN_MAPPABLE_LINE_RATIO) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "below-mappable-ratio",
      });
      continue;
    }

    const saleIngredientIds = new Set(saleIngredients.map((row) => row.ingredientId));
    const saleMatchedInRecipe = mappedLines.filter((line) =>
      saleIngredientIds.has(line.ingredientId),
    ).length;

    if (saleMatchedInRecipe < MIN_SALE_INGREDIENT_MATCHES) {
      report.skipped.push({
        idMeal: candidate.idMeal,
        strMeal: candidate.strMeal,
        reason: "below-sale-overlap",
      });
      continue;
    }

    const recipeId = slugifyThemealdbRecipeId(candidate.idMeal, meal.strMeal);
    const cookTimeMinutes = estimateThemealdbCookTimeMinutes(meal);
    const difficulty = inferThemealdbDifficulty(cookTimeMinutes);
    const steps = parseThemealdbInstructions(meal);
    const tags = parseThemealdbTags(meal);
    const summary = buildThemealdbSummary(meal.strCategory, meal.strArea, candidate.saleOverlapCount);

    await persistThemealdbRecipe({
      recipeId,
      title: meal.strMeal,
      summary,
      cookTimeMinutes,
      difficulty,
      tags,
      dietaryTags: inferDietaryTags(tags, mappedLines.map((line) => line.ingredientId)),
      steps: steps.length > 0 ? steps : [`Prepare ${meal.strMeal} following TheMealDB instructions.`],
      sourceRecipeId: candidate.idMeal,
      ingredients: mappedLines,
    });

    existingIds.add(candidate.idMeal);
    importedThisRun += 1;
    report.importedCount += 1;
    report.imported.push({
      id: recipeId,
      title: meal.strMeal,
      idMeal: candidate.idMeal,
    });
  }

  report.aliasSavedCount = normalizer.getAliasSavedCount();
  report.newIngredientCount = normalizer.getNewIngredientCount();

  return report;
}

async function loadExistingThemealdbRecipeIds(): Promise<Set<string>> {
  const pool = getDbPool();
  const result = await pool.query<{ source_recipe_id: string }>(
    `
      select source_recipe_id
      from recipes
      where source_name = $1
        and source_recipe_id is not null
    `,
    [THEMEALDB_SOURCE_NAME],
  );

  return new Set(result.rows.map((row) => row.source_recipe_id));
}

async function persistThemealdbRecipe(input: {
  recipeId: string;
  title: string;
  summary: string;
  cookTimeMinutes: number;
  difficulty: "easy" | "medium";
  tags: string[];
  dietaryTags: string[];
  steps: string[];
  sourceRecipeId: string;
  ingredients: Array<{
    ingredientId: string;
    displayName: string;
    quantityNote: string;
    matchConfidence: number;
  }>;
}) {
  const pool = getDbPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `
        insert into recipes (
          id,
          title,
          summary,
          cook_time_minutes,
          difficulty,
          tags,
          dietary_tags,
          steps,
          source_name,
          source_recipe_id,
          eligible_for_ranking
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
        on conflict (id) do nothing
      `,
      [
        input.recipeId,
        input.title,
        input.summary,
        input.cookTimeMinutes,
        input.difficulty,
        input.tags,
        input.dietaryTags,
        input.steps,
        THEMEALDB_SOURCE_NAME,
        input.sourceRecipeId,
      ],
    );

    for (const [index, line] of input.ingredients.entries()) {
      await client.query(
        `
          insert into recipe_ingredients (
            recipe_id,
            ingredient_id,
            display_name,
            quantity_note,
            sort_order,
            match_confidence
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict (recipe_id, ingredient_id) do update
          set
            display_name = excluded.display_name,
            quantity_note = excluded.quantity_note,
            sort_order = excluded.sort_order,
            match_confidence = excluded.match_confidence
        `,
        [
          input.recipeId,
          line.ingredientId,
          line.displayName,
          line.quantityNote,
          index,
          line.matchConfidence,
        ],
      );
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function buildThemealdbSummary(
  category: string | null | undefined,
  area: string | null | undefined,
  saleOverlapCount: number,
): string {
  const parts = [
    "Research import from TheMealDB aligned to this week's weekly-ad sale ingredients.",
    `Overlaps ${saleOverlapCount} on-sale catalog ingredient(s).`,
  ];

  if (category) {
    parts.push(`Category: ${category}.`);
  }
  if (area) {
    parts.push(`Cuisine: ${area}.`);
  }

  parts.push("Verify ingredients and prices in store before shopping.");
  return parts.join(" ");
}

function inferDietaryTags(tags: string[], ingredientIds: string[]): string[] {
  const dietary: string[] = [];
  const lowerTags = tags.map((tag) => tag.toLowerCase());

  if (lowerTags.some((tag) => tag.includes("vegetarian") || tag.includes("vegan"))) {
    dietary.push("vegetarian");
  }

  const meatIds = new Set([
    "chicken-thighs",
    "chicken-breast",
    "ground-beef",
    "ground-turkey",
    "italian-sausage",
    "bacon",
    "pork-shoulder",
    "salmon-fillet",
    "shrimp",
  ]);

  const hasMeat = ingredientIds.some((id) => meatIds.has(id));
  if (!hasMeat && !dietary.includes("vegetarian")) {
    dietary.push("vegetarian");
  }

  if (lowerTags.some((tag) => tag.includes("quick") || tag.includes("fast"))) {
    dietary.push("quick");
  }

  return dietary;
}

export function summarizeThemealdbImportReport(report: ThemealdbImportReport): string {
  const skipCounts = report.skipped.reduce<Record<ThemealdbImportSkipReason, number>>(
    (counts, row) => {
      counts[row.reason] = (counts[row.reason] ?? 0) + 1;
      return counts;
    },
    {} as Record<ThemealdbImportSkipReason, number>,
  );

  const skipSummary = Object.entries(skipCounts)
    .map(([reason, count]) => `${reason}=${count}`)
    .join(", ");

  return [
    `sale ingredients=${report.saleIngredientCount}`,
    `api filter calls=${report.apiFilterCalls}`,
    `candidates=${report.candidateMealCount}`,
    `imported=${report.importedCount}`,
    `aliases saved=${report.aliasSavedCount}`,
    `new catalog ingredients=${report.newIngredientCount}`,
    skipSummary ? `skipped: ${skipSummary}` : "skipped: none",
  ].join("; ");
}
