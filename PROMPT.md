# Virtual DOM & Diff Algorithm Implementation

## Response Language
All responses, comments, and documentation must be in **Korean (한국어)**.

## Project Overview
Implement React's core concepts — Virtual DOM and Diff Algorithm — from scratch using only vanilla HTML, CSS, and JavaScript (ES Modules). Build a verification web page that visually demonstrates how the algorithm works.

## Tech Stack
- HTML, CSS, JavaScript (Vanilla only, no frameworks)
- ES Modules (`type="module"`)
- No build tools, no npm

## VDOM Structure Design (React-like, with key support)

```js
// Element node
{
  type: 'element',
  tag: 'div',
  props: { id: 'app', class: 'container' },
  key: null,
  children: [...]
}

// Text node
{
  type: 'text',
  value: 'Hello'
}
```

- Separate `type` field to distinguish element vs text nodes
- Include `key` for list diff optimization (same purpose as React's key prop)
- `props` stores all HTML attributes
- `children` is an array of VNodes

## Diff Algorithm Strategy

### Patch Object Pattern
Diff produces an array of patch objects (Diff and Patch are fully decoupled):

```js
[
  { type: 'REPLACE', path: [...], newNode: {...} },
  { type: 'UPDATE_PROP', path: [...], key: 'class', value: 'active', oldValue: 'inactive' },
  { type: 'REMOVE_PROP', path: [...], key: 'class' },
  { type: 'REMOVE', path: [...] },
  { type: 'ADD', path: [...], newNode: {...} },
  { type: 'UPDATE_TEXT', path: [...], value: 'New text', oldValue: 'Old text' },
  { type: 'REORDER', path: [...], moves: [...] }
]
```

### 5 Core Diff Cases
1. **Text Change** — text node value changed → `UPDATE_TEXT`
2. **Prop Change** — attribute added/removed/changed → `UPDATE_PROP` / `REMOVE_PROP`
3. **Node Add** — new child node → `ADD`
4. **Node Remove** — child node removed → `REMOVE`
5. **Node Replace** — tag changed (e.g., `<p>` → `<span>`) → `REPLACE`

### Key-based Matching
- When comparing children, match by `key` first, then fall back to index
- Enables accurate detection of list reorder/insert/delete

## File Structure

```
index.html
src/
  vdom.js        — VNode creation, DOM↔VDOM conversion
  diff.js        — Diff algorithm (produces patch array)
  patch.js       — Apply patches to real DOM + highlight changed nodes
  history.js     — State history (undo/redo)
  app.js         — UI initialization, event binding
css/
  style.css
tests/
  test-runner.js — Simple assert utility
  diff.test.html — Browser-based test page for Diff algorithm
```

## Web Page Requirements

### Layout: Two areas + control buttons
1. **실제 영역 (Real Area)** — Shows the actual DOM result
2. **테스트 영역 (Test Area)** — Editable area where user modifies HTML
3. **Buttons**: Patch, Undo (뒤로가기), Redo (앞으로가기)

### Behavior Flow
1. On page load:
   - Convert sample HTML in Real Area to VDOM tree
   - Render Test Area from that VDOM
2. User freely edits the Test Area content
3. On "Patch" button click:
   - Convert current Test Area state to new VDOM
   - Run Diff between previous VDOM and new VDOM
   - Apply only the changed parts to Real Area
   - Save new VDOM to State History
4. Undo/Redo buttons:
   - Navigate through State History
   - Both Real Area and Test Area update to match the selected VDOM state
   - Undo/Redo also uses Diff→Patch (not full re-render), to demonstrate minimal updates

### Visual Feedback (Critical for Demo)
- **Highlight changed nodes**: When Patch runs, briefly flash/highlight (border, background color) only the DOM nodes that were actually modified. This visually proves "only changed parts are updated."
- **Diff Log Panel**: Display the patch array in a human-readable log below the main areas. Show patch type, target path, old/new values.
- **VDOM Tree Visualization**: Render the current VDOM as an interactive tree structure. Highlight nodes that differ between old and new VDOM.

### Sample HTML (initial content for Real Area)

```html
<div id="app">
  <h1>Shopping List</h1>
  <ul>
    <li class="done" data-key="item-1">Milk</li>
    <li data-key="item-2">Eggs</li>
    <li data-key="item-3">Bread</li>
  </ul>
  <p class="count">3 items</p>
</div>
```

## Test Requirements

### Browser-based test page (`tests/diff.test.html`)
- Simple test runner with pass/fail display
- Cover all 5 diff cases:
  - Text change
  - Prop add / change / remove
  - Node add
  - Node remove
  - Node replace (tag change)
- Key-based matching tests:
  - Reorder items in a keyed list
  - Insert item in the middle of a keyed list
  - Remove item from a keyed list
- Edge cases:
  - Empty tree vs non-empty tree
  - Non-empty tree vs empty tree
  - Deeply nested changes
  - Same tag, different props only
  - Multiple simultaneous changes
  - Identical trees (no patches)

## UI/UX Quality
- Portfolio-grade visual design
- Clean, modern layout
- Smooth highlight animations for changed nodes
- Clear visual distinction between Real Area and Test Area
- Responsive layout
- The test area should allow editing (use `contenteditable` or a `<textarea>` with HTML source editing)

## Edge Cases to Handle
- Text nodes with only whitespace
- Nodes with no children
- Nodes with no props
- Mixed keyed and non-keyed children
- `data-key` attribute used as key source when converting DOM→VDOM
- Boolean attributes (disabled, checked, etc.)
- Style attribute changes

## Implementation Notes
- All code comments in Korean
- Use `requestAnimationFrame` or CSS transitions for highlight animations
- Highlight duration: ~1 second with fade-out
- Keep Diff pure (no side effects) — it only produces patch objects
- Patch function handles all DOM manipulation
- History stores deep-cloned VDOM snapshots
- Test Area editing: use `<textarea>` showing HTML source code that user can edit directly (simpler and more reliable than contenteditable)
