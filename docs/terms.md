# Terms & Conditions (DRAFT — requires legal review before launch)

> **Status:** draft. Per spec Section 18, agent-drafted legal text is not
> launch-ready. Have a lawyer or legal-template service pass over this before
> publishing. The compliance open item below is **explicitly unresolved** until
> verified against applicable regulations.

## Supported Repository Types

RepoRun supports running four classes of repository, classified locally on your
machine:

- **Tier 1** — Python (`requirements.txt`) or Node (`package.json`) scripts/CLIs.
- **Tier 2** — single `Dockerfile` containerized apps.
- **Tier 3** — GPU workloads (Dockerfiles referencing CUDA/GPU runtime).
- **Tier 4** — multi-service stacks via `docker-compose.yml` / `compose.yml`.

Repositories not matching any of the above are reported as **Unsupported** with
a clear path forward.

## No Guarantee of Compatibility

RepoRun runs reliably, with clear errors when something goes wrong. We scan for
known risk patterns before running anything. We do **not** guarantee that any
specific repository will run successfully, nor that a scanned repository is
safe. You are responsible for reviewing what you run on your machine.

## Subscription

- Single plan: **$7/month or $77/year**, full access to all four tiers, no usage metering.
- Card capture, tax/VAT compliance, license-key generation, and cancellation are handled by our merchant of record (Lemon Squeezy or Gumroad). RepoRun never touches your card details.
- Trial start/end dates are stored server-side, associated with your account, to close the reinstall-abuse loophole.
- A simple hardware-derived device fingerprint is stored at signup to *flag* (not silently block) trial reuse from an already-used device.

## Cancellation

Cancellation is genuinely one-click, self-serve, and in-app — this is a hard
requirement tied directly to the "no strings attached" messaging shown at
signup. Cancellation does **not** require contacting support or leaving the app.

## Offline grace period

If RepoRun cannot re-validate your license because your device is offline (not
because the license is actually invalid), you retain full access for a 14-day
grace period. Browsing and search remain unblocked even after that; only
running repos is gated. This applies only to inability-to-check — a confirmed
cancelled or expired subscription takes effect immediately.

## Code signing & installers

At launch, installers may be unsigned. Expected SmartScreen (Windows) /
Gatekeeper (macOS) warnings are disclosed on the download page, and installers
are submitted to Microsoft's free SmartScreen reputation program. Code signing
is a tracked post-launch addition; the build pipeline is structured so it can
be added without rework.

## Open compliance item (MUST be closed before launch)

> ⚠️ **Unresolved.** Confirm card-required-trial and auto-renewal disclosure
> requirements against applicable regulations before publishing:
> - US FTC click-to-cancel rule.
> - EU consumer law.
> - India RBI e-mandate rules if targeting that market.
>
> Verify what the chosen payment gateway already handles versus what needs
> custom disclosure UI. Do not treat this as resolved by default.

## License (app)

The RepoRun application itself is **proprietary** (all rights reserved) unless
otherwise stated. Any open-source portions published separately will carry
their own explicit license documented here.
