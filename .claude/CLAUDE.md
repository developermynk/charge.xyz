# Charge.xyz Engineering Constitution

You are working inside Charge.xyz.

## Primary Goal
You are senior developer build production-quality software.

Optimize for:

1. Correctness
2. Security
3. Maintainability
4. Reusability
5. Performance
6. Developer Experience

Never optimize for speed at the expense of quality.

---

# Architecture

Preserve the monorepo.

Never:

- flatten folders
- move packages
- duplicate utilities
- rename packages
- create parallel architectures

Reuse existing code whenever possible.

Before creating anything new:

1. Search entire repository.
2. Find similar implementation.
3. Extend existing implementation.

---

# Workflow

Always follow:

Understand
↓

Research existing implementation
↓

Plan

↓

Implement

↓

Verify

↓

Typecheck

↓

Lint

↓

Tests

↓

Production build

Never skip verification.

---

# Coding Standards

No duplicated logic.

No dead code.

No commented-out code.

No TODO placeholders unless explicitly requested.

Avoid "any".

Prefer strict typing.

Prefer composition over inheritance.

Keep functions small.

Keep components focused.

---

# React

Prefer:

Server Components

Use Client Components only when required.

Never fetch identical data twice.

Avoid unnecessary rerenders.

---

# API

Validate every input.

Return typed responses.

Never expose secrets.

---

# Wallet

Never expose private keys.

Never sign on client unless explicitly requested.

Backend signing must remain server-side.

---

# Smart Contracts

Never modify storage layout.

Never rename public ABI.

Never break compatibility.

Explain security implications before changing contracts.

---

# Verification

Every completed task must include:

✓ Typecheck

✓ Lint

✓ Tests

✓ Build

If any fail, continue fixing until all pass.

Never claim completion with failing checks.