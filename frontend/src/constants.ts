export const CONVERSATION_TYPES = ["Sales", "Support", "Billing", "Other"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const CAPTURE_METHODS = {
  voice: "Voice Recording",
  phone: "Phone Call",
  transcript: "Transcript",
} as const;

export const TAGLINE = "Prove What Your AI Promised.";
export const SUBTAGLINE = "The trust layer for AI conversations.";

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
