# RecordioAI

**Prove What Your AI Promised.** — The Trust Layer for AI Agents.

Every consequential AI interaction deserves a receipt.

## Overview

RecordioAI is an AI-agent conversation trust, evidence, and verification platform. It receives supported conversation data from external AI voice agent/telephony integrations and creates cryptographically verified Conversation Receipts with transcripts, extracted products/prices/fees, commitments, and discrepancy detection.

## Product Architecture

```
AI AGENT
  → phone conversation
  → customer
  → supported conversation data
  → transcript
  → customer identification
  → products / prices / fees
  → promises / commitments
  → AI analysis
  → Conversation Receipt
  → cryptographic integrity verification
  → evidence
  → Resolve Centre
```

## Key Features

- **AI Agent Integration**: Connect Retell AI, Vapi, Bland AI, or custom webhook integrations
- **Conversation Management**: Search, filter, and view conversation history
- **Transcript Viewer**: Speaker-labeled transcripts (AI AGENT / CUSTOMER / UNKNOWN)
- **Product/Price/Fee Extraction**: AI-powered extraction with confidence scoring
- **Commitments & Promises**: Track promises with due dates and completion status
- **Promise vs Delivery**: Neutral discrepancy detection ("Potential discrepancy detected")
- **Conversation Receipts**: Cryptographically signed records with integrity hashes
- **Evidence Packages**: Export verified evidence as PDF/JSON
- **Resolve Centre**: Dispute management with audit trails
- **RevenueCat Subscriptions**: Trial, Raven ($199.99/mo), Grey Parrot ($499.99/mo), Myna ($1,119.99/mo), Enterprise

## Technology Stack

- **Framework**: React Native with Expo SDK 51
- **Language**: TypeScript
- **Navigation**: Expo Router (file-based)
- **State Management**: Zustand (local) + TanStack Query (server)
- **Styling**: Custom design system (no external UI library)
- **Authentication**: Secure storage for tokens
- **Subscriptions**: RevenueCat React Native SDK
- **Build**: EAS Build / GitHub Actions

## Design System

### Colors
- Background Primary: `#000000`
- Background Secondary: `#050505`
- Surface: `#0A0A0A`
- Surface Elevated: `#101010`
- Border: `#171717`
- Primary Blue: `#0066FF`
- Bright Blue: `#0088FF`
- Cyan Accent: `#3FE7FF`
- Text Primary: `#FFFFFF`
- Text Secondary: `#AFC5FF`
- Success: `#00D26A`
- Warning: `#F5B700`
- Error: `#FF4D5A`

### Typography
- System font stack
- Scale: xs(10) → sm(12) → base(14) → lg(16) → xl(18) → 2xl(20) → 3xl(24) → 4xl(28) → 5xl(32) → 6xl(40)

## Project Structure

```
src/
├── app/                    # Expo Router screens
│   ├── (tabs)/            # Main tab navigation
│   │   ├── index.tsx      # Home
│   │   ├── agents.tsx     # AI Agents
│   │   ├── conversations.tsx
│   │   ├── resolve.tsx    # Resolve Centre
│   │   ├── receipts.tsx   # Conversation Receipts
│   │   └── settings.tsx
│   ├── onboarding/        # Onboarding flow
│   ├── agents/            # Agent connection & detail
│   ├── conversations/     # Conversation detail
│   ├── resolve/           # Dispute management
│   ├── receipts/          # Receipt detail
│   └── settings/          # Settings & subscription
├── components/            # Reusable UI components
├── hooks/                 # Custom React hooks
├── store/                 # Zustand stores
├── services/              # API, QueryClient
├── types/                 # TypeScript types
├── constants/             # Design tokens, env
└── utils/                 # Utility functions
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Expo CLI: `npm install -g @expo/cli`
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/recordioai.git
cd recordioai

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Configure your environment variables in .env
# Required: EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
# Optional: EXPO_PUBLIC_API_BASE_URL

# Start development server
npm run start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Yes | RevenueCat public SDK key for Android |
| `EXPO_PUBLIC_API_BASE_URL` | No | Backend API base URL (default: `https://api.recordioai.com/v1`) |
| `EXPO_PUBLIC_ENVIRONMENT` | No | `development` \| `staging` \| `production` |

### RevenueCat Configuration

1. Create a RevenueCat account at https://app.revenuecat.com
2. Create a new project for RecordioAI
3. Configure products in RevenueCat dashboard:
   - `trial` - 7-day free trial (entitlement: `trial`)
   - `raven` - $199.99/month (entitlement: `raven`)
   - `grey_parrot` - $499.99/month (entitlement: `grey_parrot`)
   - `myna` - $1,119.99/month (entitlement: `myna`)
   - `enterprise` - Custom (entitlement: `enterprise`)
4. Copy the Android public SDK key to `.env`

### Android Configuration

The app is configured with:
- Package: `com.recordioai.app`
- Version Code: 1
- Version Name: 1.0.0
- Min SDK: 24
- Target SDK: 34
- Permissions: INTERNET, ACCESS_NETWORK_STATE

To build a release APK:

```bash
# Using EAS Build (recommended)
eas build --platform android --profile production

# Or locally with Gradle
cd android
./gradlew assembleRelease
```

## GitHub Actions

The repository includes a GitHub Actions workflow for:
- Dependency installation
- Type checking (`npm run typecheck`)
- Linting (`npm run lint`)
- Android APK build
- Artifact upload
- Release publishing on tag push

### Required Secrets

Configure these in GitHub repository settings:
- `EXPO_TOKEN` - Expo access token
- `ANDROID_KEYSTORE` - Base64 encoded keystore
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## Current Implementation Status

✅ **Completed**
- Project setup with Expo + TypeScript
- Design system (colors, typography, spacing)
- Core UI components (Button, Card, Input, Badge, Avatar, Modal, Sheet, etc.)
- Zustand stores (app state, entitlements)
- TanStack Query setup
- Navigation structure (tabs, modals, stack)
- Onboarding flow (4 screens)
- Home screen with agent/conversation summary
- AI Agents list, connection flow, detail
- Conversations list with search/filter
- Conversation detail with tabs (Overview, Transcript, Products, Commitments, Receipt, Evidence)
- Resolve Centre (placeholder)
- Receipts list
- Settings with theme, data retention, notifications
- Subscription screen with plan cards
- RevenueCat integration structure
- TypeScript types for all domain models

🚧 **In Progress / Placeholder**
- RevenueCat SDK initialization (requires API key)
- Backend API integration (requires API endpoint)
- AI Agent provider integrations (Retell, Vapi, Bland)
- Push notifications
- Deep linking for WhatsApp follow-up
- PDF/JSON export for evidence packages
- Cryptographic verification implementation
- Unit/integration tests
- E2E tests

## Limitations

1. **No Backend**: The app currently uses local Zustand state. A backend API is required for production.
2. **No Real Integrations**: AI agent provider connections are simulated. Real implementations need provider SDKs.
3. **No Cryptographic Verification**: The integrity hash architecture exists but needs backend implementation.
4. **RevenueCat Not Connected**: Requires valid API keys and product configuration.
5. **No Push Notifications**: Expo push service not configured.
6. **Android Only**: iOS configuration exists but untested.

## Future Integrations

- **AI Providers**: Retell AI, Vapi, Bland AI, Custom Webhooks
- **Backend**: PostgreSQL + GraphQL/REST API
- **Authentication**: Auth0, Firebase Auth, or custom JWT
- **Storage**: S3-compatible for audio/evidence files
- **Analytics**: PostHog, Amplitude, or custom
- **Error Tracking**: Sentry

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- Email: support@recordioai.com
- Documentation: https://docs.recordioai.com
- Issues: https://github.com/your-org/recordioai/issues#   R e n d e r   d e p l o y m e n t   t r i g g e r  
 