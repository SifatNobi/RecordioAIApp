export const CONVERSATION_TYPES = ["Sales", "Support", "Billing", "Other"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CAPTURE_METHODS = {
  voice: "Voice Recording",
  phone: "Phone Call",
  transcript: "Transcript",
} as const;

export const TAGLINE = "Prove What Your AI Promised.";
export const SUBTAGLINE = "The trust layer for AI conversations.";

// Fixed tag color palette — these must look identical in light & dark, so hex literals are intentional.
export const TAG_COLORS: { key: string; hex: string; label: string }[] = [
  { key: "slate", hex: "#64748B", label: "Slate" },
  { key: "red", hex: "#DC2626", label: "Red" },
  { key: "amber", hex: "#D97706", label: "Amber" },
  { key: "green", hex: "#059669", label: "Green" },
  { key: "blue", hex: "#2563EB", label: "Blue" },
  { key: "violet", hex: "#7C3AED", label: "Violet" },
];

export function tagColorHex(key?: string): string | null {
  if (!key) return null;
  const found = TAG_COLORS.find((c) => c.key === key);
  return found ? found.hex : null;
}

export const DATE_FILTERS: { key: string; label: string; days: number | null }[] = [
  { key: "all", label: "All", days: null },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
];

export const PLANS = [
  {
    id: "grey_parrot",
    name: "Grey Parrot",
    price: "$499.99",
    cadence: "/month",
    features: [
      "Unlimited conversation records",
      "AI commitment extraction",
      "SHA-256 integrity verification",
      "Evidence package export",
    ],
  },
  {
    id: "myna",
    name: "Myna",
    price: "$1,119.99",
    cadence: "/month",
    highlight: true,
    features: [
      "Everything in Grey Parrot",
      "Priority transcription",
      "Extended record retention",
      "Audio integrity hashing",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    features: [
      "Everything in Myna",
      "Custom retention policies",
      "Dedicated support",
      "Volume pricing",
    ],
  },
];
