# SIFT

Small agents. Clear signals.

SIFT is a public repository-observation workroom. Three rule-based agents collect a revision, classify changed-file metadata and publish a downloadable report with its source and input checksum. Every stage is persisted separately and visible in the interface.

## Run locally

Node 24 is required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5249. The dev server generates `.local/dev-access.json` containing private operator and scheduler keys. Unlock controls with the key icon. Never enter a wallet seed or signing key.

```sh
node scripts/provision.mjs
npm test
npm run qa
```

Provisioning runs an actual GitHub check; it never creates fictitious reports. Defaults are two public repositories: `pump-fun/pump-public-docs` and `anza-xyz/kit`. Their inclusion is observation, not an endorsement or partnership. Add a third public repository through the operator controls.

## The agents

- **Pip / Collect:** fetches the latest default-branch revision. First run: latest commit baseline. Later runs: compare the previous completed checkpoint to the current head.
- **Dot / Inspect:** applies file-path and change-type rules to metadata. Interfaces, dependencies, automation, documentation, tests and removed files are classified. This is not semantic code analysis or a security audit.
- **Bit / Publish:** writes the source-linked report, metadata and SHA-256 input checksum. Checkpoint advancement and report publication commit together.

Production workers are scheduled every ten minutes. Public UI polling reads stored results, not GitHub directly. Unchanged revisions do not create duplicate reports. Operator changes use revisions so in-flight results cannot overwrite a pause. Conditional storage writes, idempotent schedule buckets and expiring leases guard concurrent invocations.

Coverage is bounded: 3 public repositories, 100 baseline files, 300 comparison files, 6 MB per provider response, 80 retained runs, 90 reports, 180 stage events. Pagination and cap-sized responses are marked potentially incomplete. Diverged history blocks checkpoint advancement and needs operator review. Do not rely on this as your only change notification system. Export reports for permanent retention.

No repository code is executed. No GitHub token is deployed or sent by the production collector. Public API rate limits can delay checks. The client makes sequential requests, uses ETags, and retains prior state when a provider fails.

## Token discovery

The operator-selected CA is `CqV5w5NcD95HXaj8gxXy38y5EKbXkfF4WdmfaSZTpump`, configured in `src/config.mjs`. It takes precedence over automatic discovery and does not inherit a different mint's launch receipt.

The production dev wallet is `21tfESqa9Lq1g5FeCcKVqEPuSGDJ6xgdm6PMHcKJ5C8X`. Discovery was activated at finalized Solana slot `452221068`. The watcher checks every five minutes until it verifies and pins a qualifying launch. Wallet configuration is stored in the private runtime state, independently of frontend constants. Repository agents work independently of the token watcher.

Configure a public dev address in **Token monitor > Operator settings**, then review and activate. Activation records the current finalized Solana slot. The watcher checks for a future Pump token named **SIFT**, requiring the same wallet to sign as user and creator and an initialized mint account to exist. It pins a verified launch, not a transfer or purchase. Reconfiguring the wallet starts a new discovery window. No funds move.

`node scripts/provision.mjs --wallet PUBLIC_ADDRESS` configures a local watcher. Add `--production` for the production environment. Do not reuse another project's wallet without an explicit decision by its owner.

## Deployment

Set `VERCEL_TOKEN`, `VERCEL_TEAM_ID` and `VERCEL_SCOPE` in the process environment, then run `node scripts/deploy.mjs`. The script requires an existing Pro/Enterprise plan; it does not upgrade billing. It provisions an isolated Vite project with private Blob storage and authenticated cron jobs. It does not replace other projects or custom domains.

Production configuration: `SIFT_OPERATOR_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, `PUBLIC_ORIGIN` (or comma-separated `PUBLIC_ORIGINS`). `SOLANA_RPC_URL` is optional. All secrets are server-only. When adding a custom domain, update the origin allowlist for operator mutations.

Private operator access is written to `operator-access.txt`, excluded from Git and deployment. The `.local`, `.env*`, `.vercel`, artifacts and generated deployment state are excluded from source control. `lastScheduledCompletion` confirms an actual scheduler invocation; a configured schedule alone does not.

## Brand assets

`npm run assets` produces the native pixel artwork. To generate the three eight-second videos, set `FFMPEG_PATH` to the FFmpeg binary and run `npm run assets -- --film`. Images and videos are illustrations; operational claims come from actual reports, not artwork.

## Sources

- [GitHub commits and comparisons](https://docs.github.com/en/rest/commits/commits#compare-two-commits)
- [GitHub REST API best practices](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api)
- [Pump public instruction schemas](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json)

SIFT is independent and unaudited. It does not trade, custody assets, route fees or promise returns.
