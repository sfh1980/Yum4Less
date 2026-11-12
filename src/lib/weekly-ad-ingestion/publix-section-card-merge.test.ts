import { describe, expect, it } from "vitest";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import {
  collectPublixHarvestCards,
  harvestPublixVirtualList,
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

function numbered(prefix: string, count: number): { key: string; html: string }[] {
  return Array.from({ length: count }, (_, index) =>
    card(`${prefix}-${index}`, `${prefix} ${index}`),
  );
}

describe("Publix section card merge", () => {
  it("is on unless the setting is exactly 0", () => {
    expect(readPublixMergeSectionCards({ YUM4LESS_PUBLIX_MERGE_SECTION_CARDS: "1" })).toBe(
      true,
    );
    expect(readPublixMergeSectionCards({})).toBe(true);
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

  it("harvests every card when the fake page starts scrolled to the bottom", () => {
    const keys = Array.from({ length: 225 }, (_, index) => `card-${index}`);
    const windowSize = 39;
    const startIndex = keys.length - windowSize;
    const fromTheBottom = harvestPublixVirtualList({
      keys,
      startIndex,
      windowSize,
      stepCards: 39,
      resetToTop: false,
    });
    const reset = harvestPublixVirtualList({
      keys,
      startIndex,
      windowSize,
      stepCards: 39,
      resetToTop: true,
    });
    expect(fromTheBottom).toHaveLength(39);
    expect(reset).toEqual(keys);
  });

  it("does not keep a 39-card harvest when the 11-12 sections were larger", () => {
    const bogo = numbered("bogo", 225);
    const meat = numbered("meat", 145);
    const produce = numbered("produce", 89);
    const dairy = numbered("dairy", 37);
    const protein = numbered("protein", 45);
    const finalPage = bogo.slice(-39);
    const merged = collectPublixHarvestCards({
      mergeSectionCards: readPublixMergeSectionCards({}),
      mainCards: [],
      sectionCards: [bogo, meat, produce, dairy, protein],
      finalCards: finalPage,
    });
    const onlyFinal = collectPublixHarvestCards({
      mergeSectionCards: readPublixMergeSectionCards({ YUM4LESS_PUBLIX_MERGE_SECTION_CARDS: "0" }),
      mainCards: [],
      sectionCards: [bogo, meat, produce, dairy, protein],
      finalCards: finalPage,
    });
    expect(merged.size).toBe(225 + 145 + 89 + 37 + 45);
    expect(merged.size).not.toBe(39);
    expect(onlyFinal.size).toBe(39);
  });
});
