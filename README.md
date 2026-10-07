# Premier League Manager

Create a modern, ultra-responsive, landscape-oriented Online Football Career Management Web Application ("Israeli Premier League Manager"). The UI should feature a sleek dark theme (inspired by 365scores/FotMob/EA Sports UI) with a clean sidebar/top-bar navigation, optimized for desktop and landscape screens.

### 1. User Roles & Authentication (Supabase / Auth UI)
- **League Owner (Admin):**
  - Full Admin Panel to create and manage users, teams, schedules, budgets, and player databases.
  - Ability to create specific credentials (email/password or custom login code) for players (e.g., Uri, Omer, Sandor) and assign them directly to a specific Premier League team.
  - Ability to set initial team budgets for every club.
  - Ability to upload custom player face avatars/photos for any player in the database.
  - Ability to manually set up fixture rounds/schedules (מחזורים).
  - **Round Locking System:** Enforce a strict round progression rule where a new fixture round cannot start or be played until ALL matches of the current round are completed.
  - Ability to manually create/edit/delete all Teams and Players (No mock/demo auto-generated players).
- **Team Manager (User):**
  - Log in using provided credentials and automatically be redirected to their assigned team's dashboard.

### 2. Player, Formations & Squad Architecture
- **Positions:** Every player has exactly ONE position from: `GK` (שוער), `DEF` (הגנה), `MID` (קישור), `FWD` (התקפה).
- **Player Face Avatars:** Display custom uploaded player face photos next to player names in squads, lineups, match commentary, and transfer lists.
- **Popular Formations & Tactics:**
  - Support all popular tactical formations: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1, 4-3-2-1, etc.
  - Dynamic drag-and-drop or position slot selector according to the chosen formation.
- **Squad & Disciplinary Logic:**
  - Track stats per player: Goals, Assists, Yellow Cards, Red Cards, Suspensions.
  - **Suspension Logic:** Automatically flag and ban players from selection if they receive a Red Card (1 match ban) or accumulate 5 Yellow Cards (1 match ban).

### 3. Synchronized Live Online Match Engine & 2D Simulation
- **Multiplayer "Ready Up" Match Launch:**
  - Both online team managers must click "Ready" / "Start Match" before the live match simulation can begin.
- **Interactive 365scores-Style Pitch Simulation:**
  - Top Section: Live scoreboard, timer, team logos, and real-time possession/shot stats.
  - Center/Bottom Section: A realistic 2D Virtual Football Pitch showing animated real-time match events (e.g., attacks, saves, goals, fouls).
  - Live Feed: Real-time event log with animated notifications showing player face avatars for goals, assists, and red/yellow cards.

### 4. Transfer Market, Direct Offers & In-App Chat System
- **Transfer List:**
  - Dedicated market tab where managers can list players from their squad for transfer with an asking price.
  - Global view for all managers to filter and search available listed players.
- **Direct Offers & Negotiations:**
  - Option to send custom transfer offers for any player directly to another team owner (e.g., send offer to Sandor).
  - **In-App Direct Chat / Negotiation Hub:**
    - Real-time chat channel between managers to negotiate terms.
    - Embedded action buttons within the chat interface allowing team managers to accept/reject cash transfers or complete player transfers with real-time budget deductions.

### 5. UI/UX & Visual Layout Requirements
- Dark mode theme with sleek glassmorphism panels, glowing neon accents, and sharp typography.
- Dashboard views:
  1. **League Standings:** Premier League table (PTS, MP, W, D, L, GF, GA, GD).
  2. **Fixtures & Results:** Interactive round-by-round fixture viewer with status indicators for completed/pending matches.
  3. **Squad Builder & Tactics:** Tactical pitch layout supporting all popular formations with player face images.
  4. **Transfer Hub & Live Chat:** Chat interface with embedded offer cards and money/player transfer execution.
  5. **Admin Control Panel:** Full management interface for face avatars, budget setup, round controls, and manual player database creation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://soccer-summit.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/01b8dfab-69dc-4f05-8161-f6e8bb6dca33).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
