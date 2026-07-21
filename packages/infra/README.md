# @repo/infra

Deployment and infrastructure configuration for Charge.xyz.

This package is the home for environment/infra-as-code that wires the
deployable units together:

- `terraform/` — Terraform modules (e.g. hosting the Next.js web app, provisioning
  the RPC/relayer, secrets management).
- `aws/` — AWS-specific config (if applicable).

> Status: skeleton. The contracts are compiled and deployed from
> [`@repo/contracts`](../contracts), and the web app from [`web`](../../apps/web).
> Infrastructure automation lives here once added.
