# Frontend

The React/Vite frontend for the Hitbloq pool manager (see the [root README](../README.md) for the full project overview and how to run the whole stack).

## Stack

- **React 19** + **TypeScript**, built with **Vite**
- **TanStack Query** for all server-state fetching/caching (no hand-rolled fetch/loading/retry logic)
- **React Router** for client-side routing
- **Tailwind CSS**, layered with a custom pixel-art design system (`src/components/pixel-ui.css`)
- **Vitest** + **React Testing Library** for unit/component tests

## Development

```bash
npm install
npm run dev
```

This starts the Vite dev server on [localhost:5173](http://localhost:5173), proxying `/api` and `/proxy` requests to the Spring Boot backend on `localhost:3001` (see `vite.config.ts`). The backend must already be running — see the root README's "Backend dev" section.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check, then build for production into `../backend/src/main/resources/static` |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run preview` | Preview a production build locally |

## Structure

Almost everything lives in `src/components/` (pages, UI components, and the custom hooks that own each page's data-fetching/mutations), rather than a deep folder-per-feature layout. A few naming conventions worth knowing:

- `use*.ts` — a custom hook, usually owning one page's or feature's server state (e.g. `usePoolSongs.ts`, `useBeatSaverSearch.ts`)
- `*Api.ts` — thin fetch wrappers for one backend/external API (`hitbloqApi.ts`, `beatsaverApi.ts`, `authApi.ts`)
- `*Types.ts` — plain type declarations for one API's data shape (`beatSaverTypes.ts`, `hitbloqTypes.ts`)
- `*.test.ts(x)` — colocated with the file it tests
