# React + Vite

## Pipeline demo

Push a change under `frontend/` to branch `dev` to run Frontend CI. Download the
single `security-frontend-*` artifact and open its uniquely named `.html` file for Semgrep and Trivy
results. Demo mode records findings without blocking the build. Image updates
are committed to dev values on `main`; production values change only after a
promotion PR is merged into `main`. Both Devtron environments track `main`.

See [the promotion workflow](../docs/gitops-promotion.md) for the approval steps.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
