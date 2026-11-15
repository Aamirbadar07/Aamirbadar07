# Taskboard

A Trello-style project management tool: boards, lists, cards, drag-and-drop
between lists, data saved in a real database, and **role-based access**
(owner / member / viewer) as the bonus feature.

**Live demo:** _added after deployment_

On the sign-in screen, click **Owner**, **Member** or **Viewer** to try each
role on a shared demo board — no sign-up needed.

## Features

- Boards, lists and cards — create, rename, edit, delete
- Drag cards between lists and reorder them inside a list (mouse, touch, keyboard)
- Everything is saved in Postgres and survives a refresh or another device
- Live updates: two people on the same board see each other's changes
- Sign in with email and password; invite people to a board by email
- Roles, enforced by the database:

| | Owner | Member | Viewer |
|---|---|---|---|
| See the board | ✅ | ✅ | ✅ |
| Add / edit / move / delete lists and cards | ✅ | ✅ | ❌ |
| Invite people, change roles, remove members | ✅ | ❌ | ❌ |
| Rename or delete the board | ✅ | ❌ | ❌ |

## How it is built

| Part | Choice | Why |
|---|---|---|
| UI | React + TypeScript + Vite | Small, fast, typed |
| Drag and drop | [dnd-kit](https://dndkit.com) | Works with touch and keyboard, not just the mouse |
| Database, auth, live updates | [Supabase](https://supabase.com) (Postgres) | Free tier, no server of my own to run |
| Hosting | Vercel | Static site, free |

There is no custom backend. The browser talks to Supabase directly, which is
safe because the access rules are **Row Level Security policies inside the
database** (`supabase/migrations/0001_init.sql`). The UI hides buttons a
viewer cannot use, but that is only for convenience — if a viewer calls the
API by hand, Postgres itself rejects the write.

### Where things are

```
src/
  App.tsx                  session + tiny hash router
  lib/api.ts               every database call, in one file
  lib/position.ts          ordering maths for drag and drop
  components/
    AuthPage.tsx           sign in / sign up / demo accounts
    BoardsPage.tsx         list of your boards
    BoardPage.tsx          one board: state, drag and drop, live updates
    ListColumn.tsx         a list and its sortable cards
    CardModal.tsx          edit a card
    MembersModal.tsx       invite people and manage roles
supabase/migrations/       tables, triggers and security policies
```

### Three ideas worth knowing

1. **Ordering without renumbering.** Each card has a numeric `position`. When
   a card is dropped, its new position is the midpoint of its two new
   neighbours, so a move updates exactly one row.
2. **Optimistic updates.** The screen changes immediately, then the change is
   saved. If the save fails, the error is shown and the board reloads from
   the database.
3. **Roles in the database.** A `board_members` table maps user → board →
   role. One SQL helper, `private.role_on(board)`, returns the current user's
   role, and every policy is a one-line check against it.

## Run it locally

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npm run dev
```

To use your own Supabase project, run `supabase/migrations/0001_init.sql` in
its SQL editor. For instant sign-up without a confirmation email, turn off
*Authentication → Sign In / Providers → Email → Confirm email*.

## What I would improve next

- Drag to reorder whole lists (the `position` column is already there)
- Card details: due dates, labels, assignees, comments
- AI board summary (a serverless function so the API key stays private)
- Apply live changes row-by-row instead of refetching the whole board
- Automated tests for the security policies and the drag-and-drop maths
- Ownership transfer, invite links for people without an account yet
