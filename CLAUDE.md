# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

- Client portal where clients can browse, request, and track SaaS products/services.
- Monorepo with a Node.js REST API backend and a React frontend.

## Repository layout

```
/
├── backend/          # Node.js REST API
│   ├── src/
│   │   ├── config/       # env loading, constants
│   │   ├── routes/       # route definitions only (no logic)
│   │   ├── controllers/  # parse request → call service → shape response
│   │   ├── services/     # business logic
│   │   ├── repositories/ # data access only
│   │   ├── middlewares/  # auth, validation, error handling, rate limiting
│   │   ├── validators/   # request schemas (zod)
│   │   ├── utils/
│   │   └── app.js        # express app setup (no listen)
│   ├── tests/
│   └── server.js         # entry point (listen)
├── frontend/         # React app (Vite)
│   ├── src/
│   │   ├── api/          # API client + per-resource request functions
│   │   ├── components/   # shared, presentational components
│   │   ├── features/     # feature folders (auth, requests, billing, ...)
│   │   ├── hooks/        # shared custom hooks
│   │   ├── pages/        # route-level components
│   │   ├── routes/       # React Router config + guards
│   │   ├── store/        # global client state
│   │   └── main.jsx
│   └── tests/
└── CLAUDE.md
```

## Tech stack

### Backend

- Node.js (LTS) + Express
- Validation: zod
- Auth: JWT access token (short-lived) + refresh token in httpOnly cookie
- Sign-in methods: email+password, Google, Facebook, mobile number (SMS OTP). Registering creates the account immediately -- no approval step.
- Signup writes two rows in one transaction: `users` (the login record, what auth reads) and `registrations` (the permanent record of the submitted details). They are deliberately unlinked -- no FK, no `user_id` on `registrations` -- and are matched by email or phone. `role` is always forced to `CLIENT` on a public signup.
- Database: PostgreSQL + Prisma (schema in `backend/prisma/schema.prisma`; pgAdmin paste script in `backend/db/schema.sql`)
- Logging: winston
- Testing: Jest + Supertest

### Frontend

- React + Vite
- Routing: React Router
- HTTP: axios (single configured instance in `src/api/client.js`)
- Global state: Zustand (only for genuinely global state — auth user, UI prefs)
- Forms: React Hook Form + zod
- Styling: Tailwind CSS v4 (no config file; the plugin lives in `vite.config.js`, design tokens in `frontend/src/index.css` under `@theme`)
- Brand: GVN-Safestart. Single dark theme, gold `#caa649` accent on near-black surfaces, taken from gvnsafestart.com. There is no light mode, so do not add `dark:` variants.
- Gold is safe for text on the dark surfaces but fails on light ones. Gold-filled controls take near-black labels, never white.
- Animation: `motion` (import from `motion/react`). Scroll reveals go through `components/Reveal.jsx`, which handles `prefers-reduced-motion` once for the whole app.
- Icons: `@phosphor-icons/react` only. Never hand-roll SVG icon paths.
- Testing: Vitest + React Testing Library
- Do NOT use any TanStack libraries (TanStack Query, Router, Table, Form, etc.). For server data, use the `api/` functions with custom hooks in `features/*/hooks`.

## Commands

```bash
# Backend
cd backend
npm install
npm run dev        # start with watch mode
npm test           # run tests
npm run lint

# Frontend
cd frontend
npm install
npm run dev        # Vite dev server
npm test
npm run lint
npm run build
```

- Run lint and tests for the part you changed before considering a task done.

## Backend conventions

- Layering is strict: `routes → controllers → services → repositories`. Controllers never touch the DB; repositories hold no business logic.
- Validate every request body, query, and params with zod in a middleware before the controller.
- Use async/await only. Wrap controllers with an async handler so errors reach the central error middleware — no try/catch boilerplate in every controller.
- Throw typed errors (`AppError` with `statusCode` and `code`); the error middleware maps them to responses. Never leak stack traces in production.
- Consistent response shape:

  ```json
  { "success": true, "data": { } }
  { "success": false, "error": { "code": "REQUEST_NOT_FOUND", "message": "..." } }
  ```

- REST naming: plural nouns, kebab-case (`/api/v1/service-requests/:id`). Version under `/api/v1`.
- Paginate list endpoints (`?page=&limit=`), return `meta: { page, limit, total }`.
- Config comes only from env vars via `src/config`. Never hardcode secrets, never commit `.env`. Keep `.env.example` updated when adding a variable.
- Security defaults: helmet, CORS restricted to the frontend origin, rate limiting on auth routes, bcrypt for passwords, parameterized queries only.
- Authorization: check that the client owns the resource in the service layer, not just that they are logged in.

## Frontend conventions

- Functional components and hooks only. One component per file, PascalCase filenames.
- Keep components presentational where possible; data fetching lives in feature hooks (e.g. `useServiceRequests()`) that return `{ data, loading, error, refetch }`.
- All HTTP goes through `src/api/`. Components never call axios directly.
- The axios instance attaches the access token and handles 401 → refresh → retry once → logout.
- Protected pages go through a route guard in `src/routes/`.
- Handle loading, empty, and error states for every data view.
- Don't put server data in Zustand; keep it in the feature hook.
- Use environment variables via `import.meta.env.VITE_*` only; never put secrets in the frontend.
- One accent colour across the whole UI (`--color-accent-*`, currently emerald). A second accent anywhere breaks the system.
- One radius scale: `rounded-xl` on surfaces, `rounded-full` on controls.
- Buttons always come from `components/Button.jsx`. On a filled accent background use `variant="inverse"`, never an ad-hoc `className` colour override, which silently loses to the variant classes.

## General rules

- Keep changes small and focused on the task. Don't refactor unrelated code without asking.
- Match existing patterns in the codebase before introducing new ones; ask before adding a new dependency.
- Write or update tests for new endpoints and non-trivial logic.
- Do not add code comments by default. Comment only when necessary — to explain non-obvious intent, a workaround, or a constraint the code can't express. Never comment what the code already says.
- When adding a new function, always explain in your reply why it is needed: what problem it solves and why existing code doesn't already cover it.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- If a requirement is ambiguous, ask rather than guess.
