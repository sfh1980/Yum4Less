"use client";

import { useEffect, useRef } from "react";
import { TRY_AGAIN_ACTION } from "@/components/meal-planner/shopper-recovery-copy";

type TryAgainButtonProps = {
  onClick: () => void;
};

export function TryAgainButton({ onClick }: TryAgainButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <button
      ref={buttonRef}
      className="primary-button"
      type="button"
      onClick={onClick}
    >
      {TRY_AGAIN_ACTION}
    </button>
  );
}
