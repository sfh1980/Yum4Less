import { describe, expect, it } from "vitest";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import {
  collectPublixHarvestCards,
  publixCollectedCardsDocument,
  readPublixMergeSectionCards,
} from "@/lib/weekly-ad-ingestion/publix-savings-card-wait";

function card(key: string, title: string): { key: string; html: string } {
  return {
    key,
    html: `
      <div data-qa-automation="listed-savings-card" data-item-code="${key}">
        <div data-qa-automation="prod-title"><span class="PCard_title__Cw18N">${title}</span></div>
        <span class="PSavingsCard_additional-info__lOJgX">save up to $3.00</span>
      </div>`,
  };
}

function names(cards: Iterable<string>): string[] {
  return parsePublixWeeklyAd({
    html: publixCollectedCardsDocument(cards),
    networkJsonBodies: [],
  }).map((offer) => offer.productName);
}

describe("Publix section card merge", () => {
  it("leaves the setting off unless it is exactly 1", () => {
    expect(readPublixMergeSectionCards({ YUM4LESS_PUBLIX_MERGE_SECTION_CARDS: "1" })).toBe(
      true,
    );
    expect(readPublixMergeSectionCards({})).toBe(false);
    expect(readPublixMergeSectionCards({ YUM4LESS_PUBLIX_MERGE_SECTION_CARDS: "0" })).toBe(
      false,
    );
  });

  it("keeps only the final page when the setting is off", () => {
    const main = [card("main", "Publix Chicken")];
    const meat = [card("meat", "Ribeye Steak")];
    const finalPage = [card("final", "Green Beans")];
    const off = collectPublixHarvestCards({
      mergeSectionCards: false,
      mainCards: main,
      sectionCards: [meat],
      finalCards: finalPage,
    });
    const today = collectPublixHarvestCards({
      mergeSectionCards: false,
      mainCards: [],
      sectionCards: [],
      finalCards: finalPage,
    });
    expect(names(off.values())).toEqual(["Green Beans"]);
    expect([...off.values()].join("\n")).toBe([...today.values()].join("\n"));
  });

  it("unions section cards and drops a duplicate key when the setting is on", () => {
    const chicken = card("chicken", "Publix Chicken");
    const steak = card("steak", "Ribeye Steak");
    const steakAgain = card("steak", "Ribeye Steak Renamed");
    const beans = card("beans", "Green Beans");
    const merged = collectPublixHarvestCards({
      mergeSectionCards: true,
      mainCards: [chicken, steak],
      sectionCards: [[steakAgain, beans]],
      finalCards: [beans],
    });
    expect(names(merged.values())).toEqual(["Publix Chicken", "Ribeye Steak", "Green Beans"]);
    expect(merged.size).toBe(3);
  });

  it("keeps the main page when a section page fails to load", () => {
    const chicken = card("chicken", "Publix Chicken");
    const produce = card("produce", "Broccoli Crowns");
    const merged = collectPublixHarvestCards({
      mergeSectionCards: true,
      mainCards: [chicken],
      sectionCards: [null, [produce]],
      finalCards: [],
    });
    expect(names(merged.values())).toEqual(["Publix Chicken", "Broccoli Crowns"]);
  });
});
