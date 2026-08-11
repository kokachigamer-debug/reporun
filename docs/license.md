# License

## RepoRun application (proprietary)

The RepoRun desktop application source in this repository is **proprietary and
all-rights-reserved** unless you have a separate commercial agreement. You may
not redistribute the compiled installers or the source for commercial purposes
without explicit written permission.

> If you intend to open-source all or part of this codebase, replace this
> section with the chosen license (e.g., Apache-2.0 or MIT) and document the
> decision explicitly. Do not leave the license implicit (spec Section 18).

## Third-party dependencies

RepoRun depends on third-party libraries under their own licenses (MIT, Apache-2.0,
BSD, ISC, MPL, GPL-family for ClamAV if integrated, etc.). These licenses apply
to their respective components and are recorded by `cargo` (Cargo.lock +
`cargo license`) and `npm` (`package.json` license fields + `npm license`).

Notable stack components and their licenses:

| Component | License |
|---|---|
| Tauri 2.x | Apache-2.0 / MIT |
| React | MIT |
| TanStack Query | MIT |
| Tailwind CSS | MIT |
| Zustand | MIT |
| `zip` (Rust) | MIT |
| Supabase JS SDK | MIT |
| ClamAV (if integrated) | GPL |

Run `cargo license` and `npm license` in CI to regenerate the full list on
each release.
