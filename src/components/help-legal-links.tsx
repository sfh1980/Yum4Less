import Link from "next/link";

type HelpLegalLinksProps = {
  includeFeedback?: boolean;
};

export function HelpLegalLinks({ includeFeedback = true }: HelpLegalLinksProps) {
  return (
    <nav className="settings-legal-links" aria-label="Help and legal">
      <Link className="text-link" href="/faq">
        FAQ
      </Link>
      <Link className="text-link" href="/terms">
        Terms of use
      </Link>
      {includeFeedback ? (
        <Link className="text-link" href="/feedback">
          Send feedback or report a wrong price
        </Link>
      ) : null}
    </nav>
  );
}
