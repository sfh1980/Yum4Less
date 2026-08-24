"use client";

import { HelpHint } from "@/components/help-hint";
import { FAQ_SLUG } from "@/lib/faq-articles";

type StoreCoverageHelpHintProps = {
  id?: string;
};

export function StoreCoverageHelpHint({
  id = "store-coverage-help",
}: StoreCoverageHelpHintProps) {
  return <HelpHint id={id} articleSlug={FAQ_SLUG.storeMapCoverage} />;
}
