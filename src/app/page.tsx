import { CfWebAnalytics } from "@/components/cf-web-analytics";
import { MealPlanner } from "@/components/meal-planner";
import { readCfWebAnalyticsToken } from "@/lib/cf-web-analytics";
import { isFeedbackEnabled } from "@/lib/feedback/feedback-policy";
import { readGeolocationPromptTimeoutMs } from "@/lib/geolocation-prompt";
import { readPricedAreaCoverageSentence } from "@/lib/priced-area-coverage";

/**
 * The place label, feedback switch, and Cloudflare token are container env.
 * Without this, `next build` prerenders "/" and the NAS values never apply.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <CfWebAnalytics token={readCfWebAnalyticsToken()} />
      <main className="app-page">
        <MealPlanner
          feedbackEnabled={isFeedbackEnabled()}
          geolocationTimeoutMs={readGeolocationPromptTimeoutMs()}
          pricedAreaCoverageSentence={readPricedAreaCoverageSentence()}
        />
      </main>
    </>
  );
}
