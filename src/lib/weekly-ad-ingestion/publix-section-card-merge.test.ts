import { describe, expect, it } from "vitest";
import { parsePublixWeeklyAd } from "@/lib/weekly-ad-ingestion/parse-publix-weekly-ad";
import {
  collectPublixHarvestCards,
  harvestPublixVirtualList,
  publixCollectedCardsDocument,
  publixMountedCardKeys,
  publixVirtualListMaxIndex,
  readPublixMergeSectionCards,
  resetPublixVirtualListToTop,
  scrollPublixVirtualListDown,
  type PublixVirtualCardList,
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

/** One shared list. A section URL opens it already scrolled to that section. */
function sharedPublixList(sections: readonly { id: string; count: number }[]): {
  keys: string[];
  anchors: { id: string; count: number; start: number }[];
} {
  const keys: string[] = [];
  const anchors = sections.map((section) => {
    const start = keys.length;
    for (let index = 0; index < section.count; index += 1) {
      keys.push(`${section.id}-${index}`);
    }
    return { id: section.id, count: section.count, start };
  });
  return { keys, anchors };
}

/**
 * The fake settle. Reset is optional. Reading stops at the printed or half
 * count, the same way the browser settle stops before the list ends.
 */
function readPublixListUntil(input: {
  keys: readonly string[];
  startIndex: number;
  windowSize: number;
  stepCards: number;
  resetToTop: boolean;
  stopAt: number;
}): string[] {
  let list: PublixVirtualCardList = {
    keys: input.keys,
    scrollIndex: input.startIndex,
    windowSize: input.windowSize,
  };
  if (input.resetToTop) {
    list = resetPublixVirtualListToTop(list);
  }
  const seen: string[] = [];
  const seenSet = new Set<string>();
  const maxIndex = publixVirtualListMaxIndex(list);
  for (;;) {
    for (const key of publixMountedCardKeys(list)) {
      if (seenSet.has(key)) {
        continue;
      }
      seenSet.add(key);
      seen.push(key);
    }
    if (seen.length >= input.stopAt || list.scrollIndex >= maxIndex) {
      break;
    }
    const next = scrollPublixVirtualListDown(list, input.stepCards);
    if (next.scrollIndex === list.scrollIndex) {
      break;
    }
    list = next;
  }
  return seen;
}

/** Night-before section sizes. 239 is the first window every section read on 11-14. */
const PUBLIX_SECTIONS = [
  { id: "bogo", count: 220 },
  { id: "meat", count: 146 },
  { id: "produce", count: 89 },
  { id: "dairy", count: 39 },
  { id: "protein", count: 45 },
] as const;
const PUBLIX_FIRST_WINDOW = 239;

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

  it("harvests the section that was already on screen, not the top of the list", () => {
    const { keys, anchors } = sharedPublixList(PUBLIX_SECTIONS);
    const meat = anchors.find((section) => section.id === "meat");
    if (!meat) {
      throw new Error("meat anchor missing");
    }
    const atTheSection = readPublixListUntil({
      keys,
      startIndex: meat.start,
      windowSize: 39,
      stepCards: 39,
      resetToTop: false,
      stopAt: meat.count,
    });
    const sentBackToTheTop = readPublixListUntil({
      keys,
      startIndex: meat.start,
      windowSize: 39,
      stepCards: 39,
      resetToTop: true,
      stopAt: PUBLIX_FIRST_WINDOW,
    });
    expect(atTheSection[0]).toBe("meat-0");
    expect(atTheSection).toContain("meat-145");
    expect(atTheSection).not.toContain("bogo-0");
    expect(sentBackToTheTop[0]).toBe("bogo-0");
    expect(sentBackToTheTop).not.toContain("meat-145");
  });

  it("reads the final page from the top when that page opens at the bottom", () => {
    const keys = Array.from({ length: 551 }, (_, index) => `card-${index}`);
    const windowSize = 39;
    const startIndex = keys.length - windowSize;
    const finalPage = harvestPublixVirtualList({
      keys,
      startIndex,
      windowSize,
      stepCards: windowSize,
      resetToTop: true,
    });
    const leftAtTheBottom = harvestPublixVirtualList({
      keys,
      startIndex,
      windowSize,
      stepCards: windowSize,
      resetToTop: false,
    });
    expect(finalPage).toEqual(keys);
    expect(leftAtTheBottom).toHaveLength(windowSize);
    expect(leftAtTheBottom[0]).toBe(keys[startIndex]);
  });

  it("does not let the five 11-14 sections read the same first window", () => {
    const { keys, anchors } = sharedPublixList(PUBLIX_SECTIONS);
    const windowSize = 39;
    const broken = anchors.map((section) =>
      readPublixListUntil({
        keys,
        startIndex: section.start,
        windowSize,
        stepCards: windowSize,
        resetToTop: true,
        stopAt: PUBLIX_FIRST_WINDOW,
      }),
    );
    const fixed = anchors.map((section) =>
      readPublixListUntil({
        keys,
        startIndex: section.start,
        windowSize,
        stepCards: windowSize,
        resetToTop: false,
        stopAt: section.count,
      }),
    );
    expect(new Set(broken.map((cards) => cards.join("|"))).size).toBe(1);
    expect(broken[0]?.[0]).toBe("bogo-0");
    expect(broken[1]).not.toContain("meat-145");
    expect(new Set(fixed.map((cards) => cards.join("|"))).size).toBe(anchors.length);
    for (const [index, section] of anchors.entries()) {
      const cards = fixed[index] ?? [];
      expect(cards[0]).toBe(`${section.id}-0`);
      expect(cards).toContain(`${section.id}-${section.count - 1}`);
      if (section.id !== "bogo") {
        expect(cards).not.toContain("bogo-0");
      }
    }
  });
});
