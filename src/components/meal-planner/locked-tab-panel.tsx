"use client";

type LockedTabPanelProps = {
  title: string;
  message: string;
};

export function LockedTabPanel({ title, message }: LockedTabPanelProps) {
  return (
    <section className="wizard-screen" aria-labelledby="locked-tab-title">
      <h1 id="locked-tab-title" className="wizard-title">
        {title}
      </h1>
      <p className="wizard-copy" role="status">
        {message}
      </p>
    </section>
  );
}
