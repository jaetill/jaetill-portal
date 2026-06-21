# Changelog

## [1.1.1](https://github.com/jaetill/jaetill-portal/compare/v1.1.0...v1.1.1) (2026-06-21)


### Bug Fixes

* **ci:** pin release reusable workflow to commit SHA ([#65](https://github.com/jaetill/jaetill-portal/issues/65)) ([ffe6d29](https://github.com/jaetill/jaetill-portal/commit/ffe6d29fa6e19a86a15538b32ed703bea9ff412b)), closes [#47](https://github.com/jaetill/jaetill-portal/issues/47)

## [1.1.0](https://github.com/jaetill/jaetill-portal/compare/v1.0.0...v1.1.0) (2026-06-18)


### Features

* **iac:** add ADR-0035 iac-additive-guard caller ([#280](https://github.com/jaetill/jaetill-portal/issues/280)) ([#51](https://github.com/jaetill/jaetill-portal/issues/51)) ([250e9d0](https://github.com/jaetill/jaetill-portal/commit/250e9d0ef52886a5cbb1087ad754cd2b74d133ca))


### Bug Fixes

* **ci:** pin dep-watch reusable to commit SHA ([#50](https://github.com/jaetill/jaetill-portal/issues/50)) ([#63](https://github.com/jaetill/jaetill-portal/issues/63)) ([eeb98d2](https://github.com/jaetill/jaetill-portal/commit/eeb98d2fe3a04a66b0b5f99c3916f0e42fdb69b9))
* **ci:** pin iac-guard reusable workflow to commit SHA ([#62](https://github.com/jaetill/jaetill-portal/issues/62)) ([77d79f4](https://github.com/jaetill/jaetill-portal/commit/77d79f42630e89126d1c5fc4d928ba594dcc2a5b)), closes [#53](https://github.com/jaetill/jaetill-portal/issues/53)
* **ci:** scope reusable secrets explicitly (ADR-0048) ([#64](https://github.com/jaetill/jaetill-portal/issues/64)) ([b862fb8](https://github.com/jaetill/jaetill-portal/commit/b862fb8def2b37f527e25e6563cee549986b66d4))
* **iac:** grant full DynamoDB lock lifecycle to iac-drift role ([#57](https://github.com/jaetill/jaetill-portal/issues/57)) ([#60](https://github.com/jaetill/jaetill-portal/issues/60)) ([0755e1c](https://github.com/jaetill/jaetill-portal/commit/0755e1cea399c0e38ba81d56d0b38a797cc7ae8e))
* **iam:** accept environment-scoped OIDC sub for gated prod deploys (ADR-0043) ([#38](https://github.com/jaetill/jaetill-portal/issues/38)) ([04892b7](https://github.com/jaetill/jaetill-portal/commit/04892b795c78f41307ef60558de2f1beb240c278))

## 1.0.0 (2026-05-23)


### Features

* adopt Agentic Dev Environment platform (Phase 1+2) ([4b9398f](https://github.com/jaetill/jaetill-portal/commit/4b9398f6ffb179549828aa0b82e491c69e8a732a))
* adopt Agentic Dev Environment platform (Phase 1+2) ([742b272](https://github.com/jaetill/jaetill-portal/commit/742b272df34e6c3b8b11a8cc76cac1c3e8dd2bb8))
* adopt CI workflows (Phase 4 of platform adoption) ([092849d](https://github.com/jaetill/jaetill-portal/commit/092849dc8b933af4c66930e0c7bc7b2d5ba349c1))
* adopt CI workflows (Phase 4 of platform adoption) ([0ba5638](https://github.com/jaetill/jaetill-portal/commit/0ba56382e22691693d43d2da909f8cf2afff9651))
* **ci:** migrate claude-pr-review to platform reusable (ADR-0018) ([a0fbbd9](https://github.com/jaetill/jaetill-portal/commit/a0fbbd908974f0e4281d90b30dbdf1624af0b62e))
* **iac:** Phase 6 Slice 1 - terraform skeleton + S3 import ([#13](https://github.com/jaetill/jaetill-portal/issues/13)) ([64035fa](https://github.com/jaetill/jaetill-portal/commit/64035fa1a8584f790f7ff816228dd3c5ee09141c))
* **iac:** Slice 2 (IAM) - import 2 roles + 3 inline + 1 attachment ([#14](https://github.com/jaetill/jaetill-portal/issues/14)) ([956ac2a](https://github.com/jaetill/jaetill-portal/commit/956ac2a02589e025abb55d6b7780b70132b2874a))
* **iac:** Slice 3 (Lambdas) - import jaetill-portal-invite ([#15](https://github.com/jaetill/jaetill-portal/issues/15)) ([c48e1d7](https://github.com/jaetill/jaetill-portal/commit/c48e1d7a0d638f8be2ceb414e774ca98df0850ef))
* **iac:** Slice 4 (API Gateway) - jaetill-portal-api REST + perms ([#16](https://github.com/jaetill/jaetill-portal/issues/16)) ([3cc772a](https://github.com/jaetill/jaetill-portal/commit/3cc772a6d0bd885fd29cd569b150cebe3eef36dd))
* **iac:** Slice 5 (Log groups) - Phase 6 complete ([#17](https://github.com/jaetill/jaetill-portal/issues/17)) ([fed941f](https://github.com/jaetill/jaetill-portal/commit/fed941ffef41fdf0a8489be24ff6927f1127a992))
* **observability:** phase 5 - sentry browser sdk + release tagging ([#8](https://github.com/jaetill/jaetill-portal/issues/8)) ([0170ea9](https://github.com/jaetill/jaetill-portal/commit/0170ea994eb84faaf4c3f3ffcc6701918a051755))
* **observability:** Phase 7 - user feedback widget + Lambda ([#18](https://github.com/jaetill/jaetill-portal/issues/18)) ([85ae0fd](https://github.com/jaetill/jaetill-portal/commit/85ae0fdb261f2ac683d1c63290d8dd131ee91cea))
* **observability:** Phase 7 - user feedback widget + Lambda ([#19](https://github.com/jaetill/jaetill-portal/issues/19)) ([97763de](https://github.com/jaetill/jaetill-portal/commit/97763de9ad6d1fb684a6bbd16bd8c802c38e0d65))
* **observability:** wrap invite.js Lambda with Sentry (Phase 5 complete) ([#12](https://github.com/jaetill/jaetill-portal/issues/12)) ([efccbff](https://github.com/jaetill/jaetill-portal/commit/efccbff851fd5227216e58aef654f6eab93d748f))
* **orchestration:** fleet-dispatch support + retire legacy triage-bot (ADR-0020) ([#22](https://github.com/jaetill/jaetill-portal/issues/22)) ([9a96d5c](https://github.com/jaetill/jaetill-portal/commit/9a96d5ce28c54425b24049506a21a9cfeb311185))
* portal-level re-nudge for stuck users ([#1](https://github.com/jaetill/jaetill-portal/issues/1)) ([a54b2d1](https://github.com/jaetill/jaetill-portal/commit/a54b2d193b97a3c02021e4bec40867f2b478dc66))


### Bug Fixes

* **build:** strip utf-8 bom from package.json (broke vite postcss config loader) ([e335ea2](https://github.com/jaetill/jaetill-portal/commit/e335ea2e25cdb87607e054505befea0e9b985b9d))
* **ci:** adapt CI workflows for portal-specific quirks ([6d9ad34](https://github.com/jaetill/jaetill-portal/commit/6d9ad3472e839402201a8b46b73c052f74e529cf))
* **ci:** hoist NB comment out of if-block scalar (workflow was unparseable) ([#11](https://github.com/jaetill/jaetill-portal/issues/11)) ([59672b5](https://github.com/jaetill/jaetill-portal/commit/59672b55942ba89e5f40daba592f3c02a93b01b3))
* **ci:** point install-node-deps action at actions/ (out of .github/) ([d869f9e](https://github.com/jaetill/jaetill-portal/commit/d869f9e052c611f23bee78852c9f50c1e5ad3c27))
* **docs:** repair mkdocs --strict build ([#10](https://github.com/jaetill/jaetill-portal/issues/10)) ([d209991](https://github.com/jaetill/jaetill-portal/commit/d209991f6c4d6c1163211b95f9b8ec18b9aae659))
* **implementer:** allow fleet-App dispatch; drop API-key fallback ([#28](https://github.com/jaetill/jaetill-portal/issues/28)) ([c480b5b](https://github.com/jaetill/jaetill-portal/commit/c480b5b130d7bc0c3568e1323e9765706bd4fee5))
