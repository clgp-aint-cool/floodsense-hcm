# HCM Flood Tracker backend

Push a change under `backend/` to branch `dev` to run Backend CI. Download the
single `security-backend-*` artifact and open its uniquely named `.html` file for Semgrep and Trivy
results. Demo mode records findings without blocking the build. Image updates
are committed to dev values on `main`; production values change only after a
promotion PR is merged into `main`. Both Devtron environments track `main`.

See [the promotion workflow](../docs/gitops-promotion.md) for the approval steps.

Weather uses Open-Meteo current model data, with MET Norway Locationforecast as
a fallback. The API and UI identify the source, forecast status, timestamp and
precipitation interval; MET precipitation is a forecast for the next hour.
Both providers' data are attributed under CC BY 4.0. Source documentation:
[Open-Meteo](https://open-meteo.com/en/docs),
[MET Norway](https://api.met.no/doc/ForecastJSON).

Each backend process caches successful weather for about an hour with jitter
and honors a later provider `Expires` header. Failures wait at least 15 minutes;
HTTP 429 waits at least 24 hours (or longer `Retry-After`). This avoids the old
60-second cache / 15-second error retry exhausting a shared egress IP quota.
If both sources fail or return invalid/stale data, measurements remain null
and provider-specific errors are returned, never generated baseline values.

Validate with `python -m unittest discover -s tests -v`, then verify the exact
CI image in dev: inspect dashboard REST/WS weather, provider attribution and
precipitation interval. Production needs both backend and frontend promotion
PRs reviewed and merged by the owner. Roll back by reverting those promotion
commits in Git, then verify ArgoCD sync, rollout health and dashboard REST/WS.
