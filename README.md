# FocusCards

A distraction-free flashcard ecosystem for computer science and mathematics. Web-first card creation with full Markdown and LaTeX support, mobile-first review with spaced repetition.

## Architecture

```
FocusCard/
├── focuscards-web/       # Card creation & management (Vite + React)
├── focuscards-mobile/    # Card review & spaced repetition (Expo SDK 54)
└── prompts/              # Development documentation & specifications
```

- **Web Client** — Vite + React 19 + Tailwind CSS + CodeMirror editor. Used for creating, editing, and managing flashcards with live Markdown/LaTeX preview.
- **Mobile Client** — Expo SDK 54 (React Native 0.81). Used for reviewing cards with SM-2 spaced repetition algorithm.
- **Backend** — Supabase (PostgreSQL). Stores decks, cards, and check-in streaks.

## Features

- **Split-Screen Editor**: Left pane for Markdown/LaTeX source, right pane for live compiled preview.
- **Code Syntax Highlighting**: 100+ languages via CodeMirror and react-syntax-highlighter.
- **Math Rendering**: Inline and block LaTeX via KaTeX.
- **Spaced Repetition**: Two-tier SM-2 algorithm for efficient long-term retention.
- **Cross-Platform Sync**: Decks and cards sync in real-time through Supabase.

## Getting Started

### Prerequisites

- Node.js >= 22
- Supabase project (create one at [supabase.com](https://supabase.com))
- `.env` files with Supabase credentials in both `focuscards-web/` and `focuscards-mobile/`
- Apply the migration and enable email authentication as described in [supabase/README.md](supabase/README.md). Both clients require sign-in; use the same account to sync your cards.

### Web

```bash
cd focuscards-web
npm install
npm run dev
```

Opens at `http://localhost:5174`.

### Mobile

```bash
cd focuscards-mobile
npm install
npx expo start
```

Scan the QR code with Expo Go (Android/iOS) or press `w` to open in browser.

## Project Structure

### Web (`focuscards-web/`)

```
src/
├── App.jsx                                    # Main app with state management
├── components/
│   ├── CardManager/CardManager.jsx            # Browse, edit, delete cards
│   ├── Editor/EditorPane.jsx                  # CodeMirror editor (front/back fields)
│   ├── Preview/PreviewPane.jsx                # Live Markdown/LaTeX preview
│   └── Toolbar/Toolbar.jsx                    # Top navigation bar
├── hooks/useSupabase.js                       # Supabase CRUD operations
├── lib/supabase.js                            # Supabase client config
├── utils/srsEngine.js                         # SM-2 spaced repetition engine
└── utils/srsEngine.test.js                    # SRS engine unit tests
```

### Mobile (`focuscards-mobile/`)

```
src/
├── app/                                       # Expo Router file-based routing
│   ├── _layout.tsx                            # Root layout
│   ├── index.tsx                              # Deck dashboard
│   ├── pre-review.tsx                         # Pre-review gatekeeper screen
│   └── review.tsx                              # Review canvas with card flip
├── components/
│   ├── markdown-content.tsx                    # Mobile Markdown/LaTeX renderer
│   ├── animated-icon.tsx                       # Reanimated icon component
│   └── ui/collapsible.tsx                      # Collapsible UI primitive
├── hooks/use-theme.ts                          # Theme color scheme hook
├── lib/supabase.js                             # Supabase client config
├── lib/syncEngine.js                           # SRS sync engine
└── utils/srsEngine.js                          # SM-2 algorithm implementation
```

## Tech Stack

| Layer | Web | Mobile |
|-------|-----|--------|
| **Framework** | Vite 8 + React 19 | Expo SDK 54 (React Native 0.81) |
| **Styling** | Tailwind CSS 4 | StyleSheet |
| **Editor** | CodeMirror 6 + @uiw/react-codemirror | — |
| **Rendering** | react-markdown + rehype-katex | react-native-markdown-display + KaTeX |
| **State** | React hooks + useCallback | React hooks |
| **Backend** | Supabase (PostgreSQL) | Supabase (PostgreSQL) |

## License

MIT
