RecordioAI

Prove What Your AI Promised. — The Trust Layer for AI Agents.

Every consequential AI interaction deserves a receipt.

Overview

RecordioAI is an AI-agent conversation trust, evidence, and verification platform.

It receives supported conversation data from external AI voice-agent and telephony integrations, then transforms that data into Conversation Receipts containing transcripts, customer identification, extracted products, prices, fees, commitments, and discrepancy detection.

Product Architecture

AI AGENT
   ↓
Phone Conversation
   ↓
Customer
   ↓
Supported Conversation Data
   ↓
Transcript
   ↓
Customer Identification
   ↓
Products / Prices / Fees
   ↓
Promises / Commitments
   ↓
AI Analysis
   ↓
Conversation Receipt
   ↓
Cryptographic Integrity Verification
   ↓
Evidence
   ↓
Resolve Centre

Key Features

- AI Agent Integration — Connect Retell AI, Vapi, Bland AI, or custom webhook integrations.
- Conversation Management — Search, filter, and view conversation history.
- Transcript Viewer — Speaker-labeled transcripts using AI AGENT, CUSTOMER, and UNKNOWN labels.
- Product / Price / Fee Extraction — AI-powered extraction with confidence scoring.
- Commitments & Promises — Track promises with due dates and completion status.
- Promise vs Delivery — Detect potential discrepancies between commitments and delivered outcomes.
- Conversation Receipts — Cryptographically signed records with integrity hashes.
- Evidence Packages — Export verified evidence as PDF or JSON.
- Resolve Centre — Manage disputes with audit trails.
- RevenueCat Subscriptions — 7-day trial with Raven, Grey Parrot, Myna, and Enterprise plans.

Technology Stack

Technology| Implementation
Framework| React Native + Expo SDK 51
Language| TypeScript
Navigation| Expo Router
Local State| Zustand
Server State| TanStack Query
Styling| Custom Design System
Authentication| Secure Token Storage
Subscriptions| RevenueCat React Native SDK
Build| EAS Build / GitHub Actions

Design System

Colors

Token| Value
Background Primary| "#000000"
Background Secondary| "#050505"
Surface| "#0A0A0A"
Surface Elevated| "#101010"
Border| "#171717"
Primary Blue| "#0066FF"
Bright Blue| "#0088FF"
Cyan Accent| "#3FE7FF"
Text Primary| "#FFFFFF"
Text Secondary| "#AFC5FF"
Success| "#00D26A"
Warning| "#F5B700"
Error| "#FF4D5A"

Typography

System font stack.

xs(10)
sm(12)
base(14)
lg(16)
xl(18)
2xl(20)
3xl(24)
4xl(28)
5xl(32)
6xl(40)

Project Structure

src/
├── app/                    # Expo Router screens
│   ├── (tabs)/             # Main tab navigation
│   │   ├── index.tsx       # Home
│   │   ├── agents.tsx      # AI Agents
│   │   ├── conversations.tsx
│   │   ├── resolve.tsx     # Resolve Centre
│   │   ├── receipts.tsx    # Conversation Receipts
│   │   └── settings.tsx
│   ├── onboarding/         # Onboarding flow
│   ├── agents/             # Agent connection & detail
│   ├── conversations/      # Conversation detail
│   ├── resolve/            # Dispute management
│   ├── receipts/           # Receipt detail
│   └── settings/           # Settings & subscription
├── components/             # Reusable UI components
├── hooks/                  # Custom React hooks
├── store/                  # Zustand stores
├── services/               # API and QueryClient
├── types/                  # TypeScript types
├── constants/              # Design tokens and environment config
└── utils/                  # Utility functions

Getting Started

Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI
- Android Studio for Android development
- Xcode for iOS development on macOS

Installation

git clone https://github.com/your-org/recordioai.git
cd recordioai
npm install
cp .env.example .env
npm run start

Run on Android

npm run android

Run on iOS

npm run ios

Environment Variables

Variable| Required| Description
"EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY"| Yes| RevenueCat public Android SDK key
"EXPO_PUBLIC_API_BASE_URL"| No| Backend API base URL
"EXPO_PUBLIC_ENVIRONMENT"| No| "development", "staging", or "production"

Default backend URL:

https://recordioaiapp.onrender.com

RevenueCat Configuration

RecordioAI uses RevenueCat for subscription management.

Plan| Price
Trial| 7-day free trial
Raven| $199.99/month
Grey Parrot| $499.99/month
Myna| $1,119.99/month
Enterprise| Custom

Configure the corresponding products and entitlements in the RevenueCat dashboard.

The Android public SDK key is provided through:

EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY

Android Configuration

Setting| Value
Package| "com.recordioai.app"
Version Code| "1"
Version Name| "1.0.0"
Minimum SDK| "24"
Target SDK| "34"
Permissions| "INTERNET", "ACCESS_NETWORK_STATE"

GitHub Actions

The repository includes GitHub Actions support for:

- Dependency installation
- Type checking
- Linting
- Android builds
- Artifact uploads
- Release publishing on tag push

Required Repository Secrets

EXPO_TOKEN
ANDROID_KEYSTORE
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD

Current Implementation Status

Completed

- Project setup with Expo and TypeScript
- Design system
- Core UI components
- Zustand stores
- TanStack Query setup
- Navigation structure
- Onboarding flow
- Home screen
- AI Agents list and connection flow
- Agent detail screens
- Conversations list with search and filtering
- Conversation detail
- Transcript viewer
- Product / price / fee extraction interface
- Commitments interface
- Conversation Receipt interface
- Evidence interface
- Resolve Centre interface
- Receipts list
- Settings
- Subscription screen
- RevenueCat integration structure
- TypeScript domain models

In Progress / Requires External Configuration

- RevenueCat production configuration
- Backend API integration
- AI-agent provider integrations
- Push notifications
- WhatsApp follow-up deep linking
- PDF / JSON evidence export
- Cryptographic verification backend
- Automated tests
- E2E tests

Limitations

1. Backend Dependency — Production functionality requires the backend API.
2. External AI-Agent Integrations — Provider integrations require valid provider credentials and supported endpoints.
3. Cryptographic Verification — Full verification requires backend implementation.
4. RevenueCat Configuration — Subscription functionality requires valid RevenueCat configuration.
5. Push Notifications — Expo push service is not configured.
6. iOS — iOS configuration exists but has not been fully tested.

Future Integrations

- AI Providers: Retell AI, Vapi, Bland AI, and custom webhooks
- Backend: PostgreSQL + GraphQL / REST API
- Authentication: Auth0, Firebase Auth, or custom JWT
- Storage: S3-compatible object storage
- Analytics: PostHog, Amplitude, or custom analytics
- Error Tracking: Sentry

License

MIT License — see "LICENSE" (LICENSE) for details.

Support

- Email: recordioai@gmail.com
- Documentation: https://docs.recordioai.com
- Issues: https://github.com/your-org/recordioai/issues
