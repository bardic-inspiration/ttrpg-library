# Testing

Test-driven development is **required** for dev-lane code: write a failing
test before the code that makes it pass. The tools are Vitest for unit suites
and Playwright with axe-core for accessibility on built pages
([`SPEC.md`](../SPEC.md) §3.1); the commands are in
[`AGENTS.md`](../AGENTS.md) "Commands".

With an agent writing the code, the failing test is the one claim of "done"
it can't talk its way past.

## Core workflow

- **Red → Green → Refactor**, per behavior, not per module. Write the smallest
  failing test that encodes one acceptance criterion, make it pass with
  minimal code, then refactor with the test as a safety net.
- **Acceptance criteria are the pre-written failing tests.** If a criterion
  can't become a test, it isn't specific enough — raise it on the issue.
- **Bug fixes ship with a regression test** that fails before the fix.

## Organization

- **Vitest suites live in `tests/`**, mirroring the source they cover
  (`tests/rulesets/dnd-5e-2024/derive.test.ts` for
  `rulesets/dnd-5e-2024/derive.ts`), named `*.test.ts`.
- **Fixture entries live in `tests/`** alongside the suites
  ([`SPEC.md`](../SPEC.md) §4). Every validation check has a fixture that
  trips it, and every derivation a fixture that exercises it
  ([`SPEC.md`](../SPEC.md) §16, milestone 2).
- **Fixtures cover the hard cases**, not only the pretty ones: a minimal
  entry, a typical one, and a maxed-out one per type — including the stress
  cases the style guide renders ([`SPEC.md`](../SPEC.md) §9.8).
- **The worked examples are tests.** The three entries in
  [`SPEC.md`](../SPEC.md) §6.9 validate, link to each other, and render the
  numbers shown there.
- **Accessibility tests** run axe-core through Playwright against the built
  site, on the pages and themes [`SPEC.md`](../SPEC.md) §9.7 lists.
- Test names state the behavior: "rejects an unknown stats key", not
  "test_schema_2".

## Deterministic, always

- No wall-clock time, unseeded randomness, live network, or dependence on
  test order. Inject a clock (`meta.createdAt` and dated filenames are
  inputs, not `Date.now()`), seed any random source, stub the network.
- A flaky test is a defect to fix, not a reason to re-run CI until it passes.
- Visual snapshots (`npm run snapshots`) are for before/after comparison only;
  they're never a test or a CI gate ([`SPEC.md`](../SPEC.md) §9.8).

## Tests that guard the rules

A rule in [`SPEC.md`](../SPEC.md) that a machine can check has a test or lint
rule that fails when it breaks, and names the spec section it enforces
(`§6.4`) so a failure points straight at the rule. Lessons that carry across
projects:

- **One place per rule.** Derived values are computed only in the ruleset
  module ([`SPEC.md`](../SPEC.md) §6.2); test the derivation there, and test
  that the validator, index builder, and templates **call the same function**
  — assert the reference itself, not merely equal output.
- **Boundary rules belong in lint**, where they fail at the cheapest step:
  literal design values outside `tokens/` fail Stylelint
  ([`SPEC.md`](../SPEC.md) §9.6).
- **Reproducibility tests** compare two *independent* runs that share no
  state, and compare the **raw output bytes** of `library.json` — never a
  re-serialization of parsed objects, which can hide drift such as key order.

## Checking by hand

If a change affects what users see, run the site (`npm run dev`) and look at
it — the style guide page shows every template and state in both themes
([`SPEC.md`](../SPEC.md) §9.8). Automated tests don't prove an interface
works. Record what you checked in the PR's Testing section, with screenshots
([`workflow.md`](workflow.md) "Screenshots").

## Quality bar to merge

- The dev-lane checks are green, which means the full suite is. No skipped
  tests, unless marked with a reason in the code and justified in the PR.
- New behavior ships with its tests, in the same PR.
