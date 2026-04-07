# SELF_CHECK

- [x] `SPEC.md` requirements are implemented
- [x] Shared rubric was read before implementation
- [x] 3 municipality-oriented case packs were added under `data/cases`
- [x] Default `local-fixture` sample now mirrors the Ulsan youth job-support case
- [x] Change detection and impact mapping were realigned so the new sample still passes evaluation
- [x] Commands run are listed below
- [x] Open risks are listed below

## Commands Run

- `npm run test`
- `npm run check`
- `npm run start` in a background process on port `3000`
- `npm run smoke`

## Open Risks

- The case-pack clause text is intentionally normalized demo content, not verbatim ordinance text; legal-text fidelity still needs a future source-backed fetch path.
- A public live `korea-law-mcp` deployment endpoint is still not verified; current contract behavior is grounded in the public README plus local/mock integration tests.
- Search results still do not recommend which candidate should be used as `before` versus `after`.
- The evaluation set is still single-sample at runtime because `npm run eval` reads `data/samples/*`; multi-case evaluation has not been added yet.
