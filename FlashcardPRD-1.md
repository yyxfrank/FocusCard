## Product Requirements Document (PRD): FocusCards

**Document Status:** MVP Blueprint
**Target Audience:** Solo developer/student (Computer Science & Mathematics focus).
**Product Philosophy:** A distraction-free, high-efficiency flashcard ecosystem optimized for code snippets and mathematical formulas. Zero gamification bloat, zero complex folder structures.

---

### 1. Technical Architecture

To enable rapid "vibe coding" and cross-platform syncing without the overhead of maintaining a custom backend server, the MVP will utilize a Backend-as-a-Service (BaaS) architecture.

* **Web Client:** React (Next.js or Vite) with TailwindCSS.
* **Mobile Client:** React Native (via Expo).
* **Backend & Database:** Supabase (PostgreSQL).
* **Authentication:** Solo-user setup (Row-Level Security disabled or hardcoded to a single User ID for the MVP).
* **Core Libraries:**
* Editor: CodeMirror or Monaco Editor.
* Parsing: Markdown-it (or react-markdown), Prism.js/Shiki (syntax highlighting), KaTeX (math rendering).



---

### 2. Database Schema (Supabase)

The relational database relies on three core tables to manage organization, spacing algorithms, and retention tracking.

#### Table: `decks`

| Column | Type | Properties | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique deck identifier. |
| `name` | VARCHAR | Not Null | User-defined deck name. |
| `daily_review_limit` | INT | Default: `50` | Max due cards allowed in a daily session. |
| `created_at` | TIMESTAMPTZ | Default: `now()` | Timestamp of creation. |

#### Table: `cards`

| Column | Type | Properties | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique card identifier. |
| `deck_id` | UUID | Foreign Key | References `decks.id` (CASCADE). |
| `front` | TEXT | Not Null | Markdown/LaTeX source for the question. |
| `back` | TEXT | Not Null | Markdown/LaTeX source for the answer. |
| `interval_days` | INT | Default: `0` | Spaced repetition interval in days. |
| `ease_factor` | FLOAT | Default: `2.5` | Multiplier for SM-2 interval scaling. |
| `next_review` | TIMESTAMPTZ | Default: `now()` | Exact date/time the card is due next. |

#### Table: `check_ins`

| Column | Type | Properties | Description |
| --- | --- | --- | --- |
| `id` | UUID | Primary Key | Unique log identifier. |
| `check_in_date` | DATE | Unique, Default: `today` | Date the user completed a review. |

---

### 3. Web Interface: The Factory (Card Creation)

The web application serves strictly as a high-speed data entry and management tool.

* **The Utility Topbar:** A fixed, flat toolbar across the top of the viewport containing core actions.
* *Deck Controls:* **Create New Deck** | **Open Deck** | **Delete Current Deck**
* *Card Controls:* **Create New Card** | **Open Card List** | **Delete Current Card**
* *Gamification:* A streak counter (e.g., 🔥 14 Days) pinned to the far right.


* **The Editor Layout:** A split-screen environment.
* *Left Pane (Source):* Two vertically stacked plain-text fields (Front and Back). Accepts Markdown, code block backticks, and LaTeX (`$...$` for inline, `$$...$$` for block).
* *Right Pane (Preview):* Live-compiling preview that instantly renders the math and code syntax highlighting as the user types.


* **Frictionless Entry:** Pressing `Cmd + Enter` (Mac) or `Ctrl + Enter` (Windows) instantly saves the card to Supabase, clears both input fields, and snaps the cursor focus back to the "Front" field.

---

### 4. Mobile Interface: The Consumer (Card Review)

The mobile application is strictly for reviewing existing cards on the go, functioning entirely via tap/swipe mechanics.

* **Deck Dashboard:** A minimalist list of all decks. Each row displays the deck name and a numerical badge showing exactly how many cards are currently due (`next_review <= now()`). The streak counter sits in the top header.
* **Pre-Review Gatekeeper:** Tapping a deck opens a summary screen displaying the total due cards versus the `daily_review_limit`. The user can tap to edit the daily limit or press **Start Review**.
* **The Review Canvas:** A clean container displaying the rendered front of the card. Tapping anywhere on the card flips it to reveal the rendered back and three action buttons: **Forgotten**, **Unfamiliar**, and **Familiar**.

---

### 5. Spaced Repetition Logic (Two-Tier System)

The learning algorithm utilizes a small intraday cycle for immediate memorization and a large SM-2 cycle for long-term retention.

#### Tier 1: Intraday Session Queue (Small Cycle)

When a review session begins, the app fetches due cards (up to the daily limit) into a temporary client-side array.

* **Action = Forgotten / Unfamiliar:** The card is moved to the back of the temporary array. It will continually reappear in this session until marked Familiar.
* **Action = Familiar:** The card is permanently removed from the active session queue.

#### Tier 2: Database State Update (Large Cycle)

The long-term database values update based *only on the very first action* the user takes on a card during that specific session.

* **If first action was Forgotten:** Set `interval_days` to 1. Decrease `ease_factor` by 0.2 (minimum 1.3).
* **If first action was Unfamiliar:** Increase `interval_days` by 20% (minimum 1 day). Leave `ease_factor` unchanged.
* **If first action was Familiar:** Multiply `interval_days` by the current `ease_factor`.
* **Final Step:** Calculate `next_review = current_date + interval_days`. Push these exact values to Supabase.

---

### 6. Gamification & Engagement

* **The Streak System:** The first time a user successfully clears a card out of the small cycle (marks it Familiar) on a new calendar date, a row is written to the `check_ins` table.
* **Calculation:** The frontend queries this table to count consecutive calendar days. If 48 hours pass without a check-in, the streak resets to zero.
* **Feedback:** The UI quietly updates the 🔥 icon on both Web and Mobile upon daily completion.

---

### 7. Out of Scope (MVP Exclusions)

To ensure rapid deployment and maintain a pure vibe-coding workflow, the following are explicitly excluded from version 1.0:

* Multi-user authentication and distinct user accounts.
* CSV / Bulk text file importing.
* Complex folder hierarchies or sub-decks.
* Image uploads (cards will rely purely on text, code, and math).