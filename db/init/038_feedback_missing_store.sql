-- Shoppers can ask for a grocery store that did not appear on the store list.
-- Chain name only; ZIP and street address stay disallowed on the feedback payload.

alter table customer_feedback
  drop constraint if exists customer_feedback_issue_type_check;

alter table customer_feedback
  add constraint customer_feedback_issue_type_check check (
    issue_type in (
      'wrong_price',
      'missing_item',
      'missing_store',
      'stale_ad',
      'bug',
      'general',
      'other'
    )
  );
