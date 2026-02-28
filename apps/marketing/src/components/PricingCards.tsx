import { cn } from "@bahar/design-system";
import { useState } from "react";

const CheckIcon = () => (
  <svg
    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5 13l4 4L19 7"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

interface Props {
  labels: {
    monthly: string;
    annual: string;
    save: string;
  };
  free: {
    name: string;
    description: string;
    price: string;
    period: string;
    cta: string;
    features: string[];
  };
  pro: {
    name: string;
    description: string;
    priceMonthly: string;
    priceAnnual: string;
    periodMonthly: string;
    periodAnnual: string;
    cta: string;
    features: string[];
  };
  trust: {
    noCard: string;
    cancel: string;
    secure: string;
  };
}

export default function PricingCards({ labels, free, pro, trust }: Props) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  const isMonthly = billing === "monthly";

  return (
    <>
      {/* Billing toggle */}
      <div className="mt-10 flex items-center justify-center gap-3">
        <button
          className={cn(
            "cursor-pointer rounded-full px-4 py-2 font-medium text-sm shadow-lg transition-all duration-200",
            isMonthly
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
          onClick={() => setBilling("monthly")}
          type="button"
        >
          {labels.monthly}
        </button>
        <button
          className={cn(
            "cursor-pointer rounded-full border border-px px-4 py-2 font-medium text-sm shadow-lg transition-all duration-200",
            !isMonthly
              ? "bg-primary text-primary-foreground hover:bg-primary/80"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          )}
          onClick={() => setBilling("annual")}
          type="button"
        >
          <span className="flex items-center gap-2">
            {labels.annual}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-semibold text-xs",
                !isMonthly
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-success/10 text-success"
              )}
            >
              {labels.save}
            </span>
          </span>
        </button>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
        {/* Free card */}
        <div className="relative rounded-3xl border border-border bg-card p-8">
          <h3 className="font-semibold text-foreground text-lg">{free.name}</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {free.description}
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-bold text-4xl text-foreground tracking-tight">
              {free.price}
            </span>
            <span className="text-muted-foreground text-sm">{free.period}</span>
          </div>
          <a
            className="mt-6 block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-center font-semibold text-foreground text-sm transition-colors hover:bg-muted"
            href="https://bahar.dev/settings#billing"
          >
            {free.cta}
          </a>
          <ul className="mt-8 space-y-3">
            {free.features.map((feature) => (
              <li
                className="flex items-start gap-3 text-muted-foreground text-sm"
                key={feature}
              >
                <CheckIcon />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro card */}
        <div className="relative rounded-3xl border border-primary/20 bg-secondary p-8 shadow-lg shadow-primary/10">
          <h3 className="font-semibold text-foreground text-lg">{pro.name}</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            {pro.description}
          </p>
          <div className="mt-6 flex items-baseline gap-1">
            <span className="font-bold text-4xl text-foreground tracking-tight">
              {isMonthly ? pro.priceMonthly : pro.priceAnnual}
            </span>
            <span className="text-muted-foreground text-sm">
              {isMonthly ? pro.periodMonthly : pro.periodAnnual}
            </span>
          </div>
          <a
            className="mt-6 block w-full rounded-xl bg-primary px-4 py-2.5 text-center font-semibold text-primary-foreground text-sm transition-colors hover:bg-primary/90"
            href="https://bahar.dev/settings#billing"
          >
            {pro.cta}
          </a>
          <ul className="mt-8 space-y-3">
            {pro.features.map((feature, index) => (
              <li
                className="flex items-start gap-3 text-muted-foreground text-sm"
                key={feature}
              >
                <CheckIcon />
                <span
                  className={cn(index === 0 && "font-semibold text-foreground")}
                >
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm sm:gap-10">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          {trust.noCard}
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 10V3L4 14h7v7l9-11h-7z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          {trust.cancel}
        </div>
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
          {trust.secure}
        </div>
      </div>
    </>
  );
}
