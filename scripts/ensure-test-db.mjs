import { execSync } from "node:child_process";

const CONTAINER_NAME = "yum4less-postgres";
const DEFAULT_DATABASE_URL =
  "postgresql://postgres:postgres@localhost:5433/yum4less_dev";
const MAX_HEALTH_ATTEMPTS = 30;
const HEALTH_POLL_MS = 2000;

function run(command) {
  execSync(command, { stdio: "inherit", shell: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dockerAvailable() {
  try {
    execSync("docker info", { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

function isCiEnvironment() {
  return process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";
}

function canResetDatabaseAutomatically() {
  return (
    isCiEnvironment() ||
    process.env.YUM4LESS_TEST_DB_RESET === "1" ||
    process.env.YUM4LESS_ALLOW_DB_RESET === "1"
  );
}

function containerHealthStatus() {
  try {
    return execSync(
      `docker inspect --format="{{.State.Health.Status}}" ${CONTAINER_NAME}`,
      { encoding: "utf8", shell: true },
    ).trim();
  } catch {
    return "missing";
  }
}

async function waitForHealthyContainer() {
  for (let attempt = 1; attempt <= MAX_HEALTH_ATTEMPTS; attempt += 1) {
    const status = containerHealthStatus();
    if (status === "healthy") {
      return;
    }

    if (attempt === MAX_HEALTH_ATTEMPTS) {
      throw new Error(
        `Timed out waiting for ${CONTAINER_NAME} to become healthy (last status: ${status}).`,
      );
    }

    await sleep(HEALTH_POLL_MS);
  }
}

function seedMatchesCurrentMvp() {
  try {
    const catalogStoreCount = execSync(
      `docker exec ${CONTAINER_NAME} psql -U postgres -d yum4less_dev -tAc "select count(*) from stores;"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const mockPriceCount = execSync(
      `docker exec ${CONTAINER_NAME} psql -U postgres -d yum4less_dev -tAc "select count(*) from price_observations where source_name = 'mock-market-data';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const recipeCount = execSync(
      `docker exec ${CONTAINER_NAME} psql -U postgres -d yum4less_dev -tAc "select count(*) from recipes where source_name = 'yum4less-internal-catalog';"`,
      { encoding: "utf8", shell: true },
    ).trim();
    const dynamicPricingColumnCount = execSync(
      `docker exec ${CONTAINER_NAME} psql -U postgres -d yum4less_dev -tAc "select count(*) from information_schema.columns where table_name = 'price_observations' and column_name in ('last_verified_at', 'source_kind', 'valid_through');"`,
      { encoding: "utf8", shell: true },
    ).trim();

    return (
      catalogStoreCount === "8" &&
      mockPriceCount === "0" &&
      Number(recipeCount) >= 3 &&
      dynamicPricingColumnCount === "3"
    );
  } catch {
    return false;
  }
}

async function resetDatabaseVolume() {
  console.log("Resetting Yum4Less test database volume...");
  run("npm run db:reset");
  await waitForHealthyContainer();
}

export async function ensureTestDatabase() {
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = DEFAULT_DATABASE_URL;
  }

  if (!dockerAvailable()) {
    throw new Error(
      "Docker is not available. Start Docker Desktop, then rerun this command. Use `npm test` only for the non-DB suite.",
    );
  }

  if (process.env.YUM4LESS_TEST_DB_RESET === "1") {
    await resetDatabaseVolume();
    return;
  }

  const health = containerHealthStatus();
  if (health !== "healthy") {
    console.log(`Starting Yum4Less Postgres container (previous status: ${health})...`);
    run("npm run db:up");
    await waitForHealthyContainer();
  }

  if (!seedMatchesCurrentMvp()) {
    if (!canResetDatabaseAutomatically()) {
      throw new Error(
        "Local Postgres seed looks stale. Start Docker Desktop if needed, then run `npm run db:reset` only after confirming you are okay recreating the local dev database volume.",
      );
    }

    console.log(
      "Local Postgres seed looks stale (missing expected MVP stores). Recreating volume...",
    );
    await resetDatabaseVolume();
  }
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"));

if (invokedDirectly) {
  ensureTestDatabase().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
