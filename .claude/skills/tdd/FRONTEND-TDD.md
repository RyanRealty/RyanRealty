# Frontend TDD — complex client state

When your change touches client components with non-trivial state — multi-step explorers, filter panels, wizards, anything where state transitions have rules — use this workflow.

## When to use this

- Creating or modifying a reducer
- Adding complex state transitions or derived-state logic
- Any client logic where "what state comes next" has business rules worth getting right

Skip it for trivial `useState` toggles — a boolean open/closed flag needs no reducer and no test.

## Reducer choice

Use React's built-in `useReducer` with a pure reducer function. (The source pattern mandates `use-effect-reducer`; that library is not a dependency here — side effects stay in the component or in event handlers, and the reducer stays pure.)

## Workflow

### 1. Extract state logic into a pure, testable module

Separate the reducer, transition helpers, and derived-state selectors from the component. Place them in their own file next to the component — e.g. `components/site/sell/sell-plan-reducer.ts` beside `SellPlanExplorer.client.tsx` — so they can be tested without React, jsdom, or rendering.

### 2. Write a SINGLE failing test

Test the state logic directly: given a state and an action, assert on the returned state. Colocate as `sell-plan-reducer.test.ts`. Plain vitest, no render.

### 3. Make it pass with the simplest implementation

Just enough logic to go green. Don't anticipate future actions or edge cases yet.

### 4. Repeat 2 & 3 until all actions and edge cases are covered

One test per action or edge case. Keep the red-green cycle tight — never batch.

### 5. Refactor under green tests

Extract helpers, simplify switch arms, improve types. Run tests after every change.

### 6. Wire into the component

Only after the state logic is fully tested and green, integrate it. The component layer stays thin — dispatch actions, render state, build UI from `@/components/ui/` per the design-system rule.

After wiring, the verify-before-moving-on rule applies: load the surface in the browser and exercise the interactions before calling it done.
