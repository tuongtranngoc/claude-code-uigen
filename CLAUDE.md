# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language, Claude generates the code, and a live preview renders in an iframe. All files are managed in a virtual file system (no disk I/O).

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations
npm run dev          # Dev server with Turbopack (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (all tests)
npx vitest run src/lib/__tests__/file-system.test.ts  # Single test file
npm run db:reset     # Reset SQLite database
npx prisma generate  # Regenerate Prisma client after schema changes
npx prisma studio    # Database GUI
```

Note: Dev/build/start scripts require `NODE_OPTIONS='--require ./node-compat.cjs'` (already configured in package.json) for Node 25+ Web Storage compatibility.

## Architecture

### Tech Stack
Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS 4 / Prisma + SQLite / Vercel AI SDK with Claude Haiku 4.5 / shadcn/ui components

### Core Flow
1. User sends prompt via `ChatInterface` → `POST /api/chat`
2. Claude streams response with tool calls (`str_replace_editor`, `file_manager`)
3. Tools operate on `VirtualFileSystem` instance (in-memory Map of files)
4. File changes propagate via `FileSystemContext` to `PreviewFrame`
5. Babel Standalone transforms JSX → JS, generates HTML with ES module import maps
6. Preview renders in sandboxed iframe
7. Authenticated users get projects saved to SQLite via Prisma

### Key Modules
- **`src/lib/file-system.ts`** — `VirtualFileSystem` class: in-memory file tree, serialized to JSON for DB persistence
- **`src/lib/provider.ts`** — Returns Anthropic model or `MockLanguageModel` if no API key set
- **`src/lib/tools/`** — AI tool definitions (`str_replace_editor` for file CRUD, `file_manager` for rename/delete)
- **`src/lib/transform/jsx-transformer.ts`** — Babel JSX transform and preview HTML generation
- **`src/lib/contexts/`** — React contexts for chat state (`useChat` from AI SDK) and file system state
- **`src/lib/auth.ts`** — JWT session management (server-only, httpOnly cookies, 7-day expiry, bcrypt)
- **`src/actions/`** — Server Actions for auth (signUp/signIn/signOut) and project CRUD
- **`src/app/api/chat/route.ts`** — Streaming chat endpoint (maxSteps: 40, maxTokens: 10,000)

### Layout
Three-panel resizable layout: Chat (left 35%) | Preview + Code Editor (right 65%). Code view splits into FileTree + Monaco Editor.

### Middleware
`src/middleware.ts` protects `/api/projects` and `/api/filesystem` routes — returns 401 if no valid JWT session. Static assets and favicon are excluded.

### Database
SQLite with two models: `User` (email/password) and `Project` (name, messages as JSON string, data as serialized VirtualFileSystem). Schema at `prisma/schema.prisma`, Prisma client generated to `src/generated/prisma/`.

## Testing
- Vitest with jsdom environment and React Testing Library
- Path alias `@/` works in tests via `vite-tsconfig-paths`
- Run single test: `npx vitest run src/lib/__tests__/file-system.test.ts`

## Environment
- `ANTHROPIC_API_KEY` in `.env` — app runs without it using a `MockLanguageModel` that returns static code

## Conventions
- Path alias: `@/` maps to `src/`
- Components in PascalCase, utilities in camelCase
- Tests colocated in `__tests__/` directories next to source
- `"use client"` / `"use server"` directives mark component boundaries
- shadcn/ui config in `components.json` (new-york style, CSS variables)
- `node-compat.cjs` removes `globalThis.localStorage`/`sessionStorage` for Node 25+ SSR compatibility
- Use comments sparingly — only comment complex code
