# Repository Guidelines

## Project Structure & Module Organization

ShadowKey has four distinct layers:

- **`src/`** — React/TypeScript SPA. `src/lib/crypto.ts` handles AES-GCM 256-bit encryption via the Web Crypto API (client-side only — keys never leave the browser). `src/lib/realtime.ts` drives the live vault approval flow via Supabase Realtime.
- **`supabase/functions/`** — Edge Functions run in the **Deno runtime** (not Node.js). Each subdirectory is a separate deployable function; migrations live in `supabase/migrations/`.
- **`contracts/`** — `ShadowVault.sol` deployed on Base Sepolia. The ABI consumed by the frontend is at `src/lib/ShadowVaultABI.json`. Hardhat config is `hardhat.config.cjs`.
- **`sdk/`** — Standalone npm package (`shadowkey-agent-sdk`) with its own `tsconfig.json` and `package.json`. Requires a separate build and publish step independent of the main app.

## Build, Test, and Development Commands

```bash
npm run dev              # Vite dev server
npm run build            # Production build
npm run typecheck        # tsc --noEmit (strict mode)
npm run lint             # ESLint
npm run compile          # Hardhat: compile contracts
npm run test:contract    # Hardhat: run all 19 contract tests
npx hardhat test --grep "pattern"  # Run a single contract test
npm run deploy:sepolia   # Deploy ShadowVault to Base Sepolia
npm run deploy:mainnet   # Deploy ShadowVault to Base Mainnet
```

## Coding Style & Naming Conventions

TypeScript uses `strict: true`, `noUnusedLocals`, and `noUnusedParameters` (`tsconfig.app.json`). All code must pass `npm run typecheck`.

ESLint enforces `typescript-eslint/recommended`, `react-hooks/recommended`, and `react-refresh`. Run `npm run lint` before committing.

Tailwind CSS uses **class-based dark mode** (`dark:` prefix). Custom animations (`slide-in`, `scale-in`, `fade-in`) are defined in `tailwind.config.js`. No Prettier is configured — avoid formatting-only commits.

## Testing Guidelines

Contract tests use Hardhat + Chai in `test/ShadowVault.test.cjs`. All 19 must pass before deploying. No frontend test framework is configured; verify UI changes via `npm run dev`.

## Commit Guidelines

Follow the pattern from git history: `feat:`, `fix:`, `docs:` prefixes. All commits go directly to `main`. Keep scope focused — one logical change per commit.
