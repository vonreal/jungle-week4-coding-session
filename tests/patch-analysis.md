# patch.js & patch.test.html 분석

---

## 0. 전체 동작 순서도

### 0-1. 앱 실행 흐름 (index.html 기준)

```
┌─────────────────────────────────────────────────────────────┐
│  페이지 로드                                                  │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  실제 DOM 읽기                                                │
│  <div id="app">...</div>                                     │
└─────────────────────────────────────────────────────────────┘
          │
          │  domToVdom()   ← vdom.js
          ▼
┌─────────────────────────────────────────────────────────────┐
│  oldVDOM 생성 및 저장                                         │
│  { type:'element', tag:'div', children:[...] }               │
└─────────────────────────────────────────────────────────────┘
          │
          │  vdomToDom()   ← vdom.js
          ▼
┌─────────────────────────────────────────────────────────────┐
│  테스트 영역 렌더링                                           │
│  (사용자가 여기서 HTML 수정)                                   │
└─────────────────────────────────────────────────────────────┘
          │
          │  Patch 버튼 클릭
          ▼
┌─────────────────────────────────────────────────────────────┐
│  테스트 영역 → newVDOM 생성                                   │
│  domToVdom()   ← vdom.js                                     │
└─────────────────────────────────────────────────────────────┘
          │
          │  diff(oldVDOM, newVDOM)   ← diff.js
          ▼
┌─────────────────────────────────────────────────────────────┐
│  패치 배열 생성                                               │
│  [ {type:'UPDATE_TEXT', path:[0,0], value:'새값'},           │
│    {type:'ADD',         path:[2],   newNode:{...}},          │
│    {type:'REMOVE',      path:[1]                } ]          │
└─────────────────────────────────────────────────────────────┘
          │
          │  applyPatches()   ← patch.js
          ▼
┌─────────────────────────────────────────────────────────────┐
│  패치 타입별 분기                                             │
│                                                              │
│  ADD / REPLACE ──→ vdomToDom()     ← vdom.js 재사용          │
│                    새 VDOM → 실제 DOM 변환                    │
│                    insertBefore / replaceChild               │
│                                                              │
│  UPDATE_PROP   ──→ setDomProp()    ← vdom.js 재사용          │
│                    불리언/일반 속성 구분해서 setAttribute      │
│                                                              │
│  REMOVE_PROP   ──→ removeAttribute()                         │
│                                                              │
│  UPDATE_TEXT   ──→ textContent 직접 변경                      │
│                                                              │
│  REMOVE        ──→ highlightNode(node, true)  즉시           │
│                    setTimeout(removeChild, 400ms)  지연       │
└─────────────────────────────────────────────────────────────┘
          │
          │  highlightNode()   ← patch.js 내부
          ▼
┌─────────────────────────────────────────────────────────────┐
│  시각적 피드백                                                │
│  변경 노드 → patch-highlight (초록 테두리, 1200ms 후 제거)    │
│  삭제 노드 → patch-remove    (빨간 테두리, 1200ms 후 제거)    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  실제 DOM 업데이트 완료                                       │
│  newVDOM → history에 저장 (undo/redo 대비)                   │
└─────────────────────────────────────────────────────────────┘
```

---

### 0-2. vdom.js가 두 번 등장하는 이유

```
vdom.js 사용 시점 1 — 앞단 (DOM → VDOM 변환)
  domToVdom(실제DOM) → oldVDOM, newVDOM 생성
  페이지 로드 시, Patch 버튼 클릭 시 호출

vdom.js 사용 시점 2 — 중간 (patch.js 내부)
  ADD / REPLACE 패치 처리 시 → vdomToDom(patch.newNode)
  UPDATE_PROP 패치 처리 시   → setDomProp(node, key, value)
  새 노드를 만들거나 속성을 적용할 때만 선택적으로 호출
```

```
❌ 잘못된 이해 (직렬 순서로 보는 것)
실제DOM → vdom.js → diff.js → patch.js → vdom.js → 웹 표시

✅ 올바른 이해
실제DOM ──→ vdom.js(domToVdom) ──→ diff.js ──→ patch.js ──→ 웹 표시
                                                   │
                                              내부에서 필요시
                                              vdom.js 재호출
                                           (vdomToDom, setDomProp)
```

---

### 0-3. patch.test.html 실행 순서도

```
브라우저에서 patch.test.html 열기
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  모듈 import                                                  │
│  diff, applyPatches, createElement, createText, vdomToDom   │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  runTests() 자동 실행                                         │
│  카운터·배열 초기화                                           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  describe() 8개 순차 실행                                     │
│  → 각 it()이 itQueue에 등록됨  (실행 안 함)                   │
│                                                              │
│  itQueue = [                                                 │
│    { name:'텍스트 노드 값이 바뀐다', fn, group },             │
│    { name:'patch-highlight가 붙는다', fn, group },           │
│    ...총 N개...                                              │
│  ]                                                           │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  for...of 루프 — itQueue 순서대로 await 실행                  │
│                                                              │
│  각 테스트 내부 4단계:                                        │
│  1) oldV, newV VDOM 정의                                     │
│  2) mount(oldV) → fixture div에 실제 DOM 생성                │
│  3) applyPatches(root, diff(oldV, newV))  ← patch.js 호출   │
│  4) DOM 상태 검증 → 실패시 throw, 통과시 종료                 │
│                                                              │
│  REMOVE 테스트의 경우:                                        │
│  3) applyPatches() → patch.js setTimeout(400ms) 예약         │
│  3-1) await wait(460) → 400ms 완료 대기                      │
│  4) DOM에서 노드 사라졌는지 검증                              │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  renderResults()                                             │
│  groups 배열 → HTML 변환 → #test-results div에 주입          │
│  통과: 초록 배경 / 실패: 빨간 배경                            │
└─────────────────────────────────────────────────────────────┘
```

---

### 0-4. 하나의 테스트 케이스 내부 상세 흐름

```
it('자식 끝에 노드가 추가된다') 실행 시

patch.test.html                              patch.js / vdom.js
────────────────────────────────────────────────────────────────

1. VDOM 정의
   oldV = el('ul', [li(A)])
   newV = el('ul', [li(A), li(B)])

2. mount(oldV)
   vdomToDom(oldV) ──────────────────────→  vdom.js: createElement('ul')
                                                      createElement('li') → 'A'
   fixture.appendChild(dom)
   root = <ul><li>A</li></ul>  (실제 DOM)

3. diff(oldV, newV)
   → [{ type:'ADD', path:[1], newNode: li(B) }]

4. applyPatches(root, patches) ──────────→  patch.js: applyPatches()
                                              REMOVE 없음 → 정렬 생략
                                              ADD 패치 처리:
                                                parentPath = []  → parent = root
                                                childIndex = 1
                                                vdomToDom(li(B)) ─→ vdom.js: 새 <li>B</li> 생성
                                                refNode = childNodes[1] = null
                                                → appendChild(newDom)
                                                highlightNode(newDom)
                                                  → classList.add('patch-highlight')
                                                  → setTimeout(remove, 1200ms)

5. DOM 검증
   root.querySelectorAll('li') = [<li>A</li>, <li>B</li>]
   items.join(',') === 'A,B'  → throw 없음 → 테스트 통과 ✅
```

---

## 1. 전체 구조 — 파일 간 관계

```
diff.js          patch.js              vdom.js
  │                 │                     │
  │   패치 배열      │   vdomToDom()       │
  └──────────────→  │ ←───────────────────┘
  두 VDOM 비교해서   │   setDomProp()
  패치 목록 생성     │
                    ↓
              실제 DOM 변경
                    ↑
             patch.test.html
             applyPatches() 호출 후
             DOM 상태 검증
```

- `patch.js`는 `diff.js`가 만든 패치 배열을 받아 실제 DOM에 반영한다
- `patch.js`는 DOM 조작에 필요한 `vdomToDom`, `setDomProp`을 `vdom.js`에서 가져다 쓴다
- `patch.test.html`은 `patch.js`의 `applyPatches()`를 직접 호출해서 결과를 DOM으로 검증한다

---

## 2. patch.js — 동작 방식

### 2-1. 진입점 — `applyPatches()`

```js
// patch.js
export function applyPatches(rootEl, patches) {
  const removes = patches.filter(p => p.type === 'REMOVE');
  const others  = patches.filter(p => p.type !== 'REMOVE');

  const sortedRemoves = [...removes].sort((a, b) => {
    const aLast = a.path[a.path.length - 1] ?? 0;
    const bLast = b.path[b.path.length - 1] ?? 0;
    return bLast - aLast;  // 내림차순
  });

  for (const patch of sortedRemoves) { applyPatch(rootEl, patch); }
  for (const patch of others)        { applyPatch(rootEl, patch); }
}
```

**REMOVE를 먼저, 내림차순으로 처리하는 이유**

```
자식 노드: [A, B, C]  →  B, C 삭제해야 하는 상황

오름차순(잘못된 방식):         내림차순(올바른 방식):
1. index[1] = B 삭제          1. index[2] = C 삭제
   → [A, C]                      → [A, B]
2. index[2] → C가 없음!       2. index[1] = B 삭제
   ❌ 인덱스가 밀려버림            → [A]  ✅
```

---

### 2-2. 핵심 내부 함수 — `getNodeByPath()`

```js
// patch.js
function getNodeByPath(rootEl, path) {
  if (!path || path.length === 0) return rootEl;

  let current = rootEl;
  for (const idx of path) {
    const children = getSignificantChildren(current);
    current = children[idx] ?? null;
  }
  return current;
}

function getSignificantChildren(node) {
  return Array.from(node.childNodes).filter(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      return child.textContent.trim() !== '';  // 공백 텍스트 제외
    }
    return true;
  });
}
```

**path 탐색 예시**

```
path = [0, 1] 일 때

rootEl
  ├─ 0번 자식: <ul>      ← 첫 번째 순회
  │    ├─ 0번 자식: <li>A</li>
  │    └─ 1번 자식: <li>B</li>  ← 두 번째 순회 → 이 노드 반환
  └─ 1번 자식: <p>

공백 텍스트 노드가 있어도 getSignificantChildren()이 걸러내므로
들여쓰기된 HTML에서도 인덱스가 정확하게 유지된다
```

---

### 2-3. 패치 타입별 처리 — `applyPatch()`

#### REPLACE
```js
// patch.js
if (type === 'REPLACE') {
  const node   = getNodeByPath(rootEl, path);
  const newDom = vdomToDom(patch.newNode);      // 새 VDOM → 실제 DOM
  node.parentNode?.replaceChild(newDom, node);  // 기존 노드를 새 노드로 교체
  highlightNode(newDom);
}
```
> 태그가 다르거나 (p→span), 타입이 다른 경우 (text↔element) 노드를 통째로 교체

---

#### UPDATE_TEXT
```js
// patch.js
if (type === 'UPDATE_TEXT') {
  const node = getNodeByPath(rootEl, path);
  node.textContent = patch.value;                // 텍스트 직접 교체
  highlightNode(node.parentNode || node);        // 텍스트 노드의 부모 하이라이트
}
```
> 텍스트 노드는 `classList`가 없으므로 부모 엘리먼트에 하이라이트 부착

---

#### UPDATE_PROP
```js
// patch.js
if (type === 'UPDATE_PROP') {
  const node = getNodeByPath(rootEl, path);
  setDomProp(node, patch.key, patch.value);  // vdom.js의 setDomProp 호출
  highlightNode(node);
}
```

```js
// vdom.js — setDomProp() 내부
export function setDomProp(el, key, value) {
  const booleanAttrs = ['disabled', 'checked', 'readonly', ...];
  if (booleanAttrs.includes(key)) {
    value ? el.setAttribute(key, '') : el.removeAttribute(key);
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(el.style, value);
  } else {
    el.setAttribute(key, value);
  }
}
```
> 불리언 속성(disabled, checked)과 일반 속성을 구분해서 처리

---

#### REMOVE_PROP
```js
// patch.js
if (type === 'REMOVE_PROP') {
  const node = getNodeByPath(rootEl, path);
  node.removeAttribute(patch.key);  // 속성 직접 제거
  highlightNode(node);
}
```

---

#### ADD
```js
// patch.js
if (type === 'ADD') {
  const parentPath = path.slice(0, -1);          // 부모 경로
  const childIndex = path[path.length - 1];      // 삽입 위치 인덱스
  const parent     = getNodeByPath(rootEl, parentPath);
  const newDom     = vdomToDom(patch.newNode);

  const refNode = parent.childNodes[childIndex] ?? null;
  refNode ? parent.insertBefore(newDom, refNode) // 중간 삽입
          : parent.appendChild(newDom);          // 끝에 추가
  highlightNode(newDom);
}
```

```
path = [1] 인 경우

부모 노드의 childNodes:
  [0]: <li>A</li>
  [1]: <li>C</li>  ← refNode

→ insertBefore(새 노드, C)
→ [A, 새 노드, C]
```

---

#### REMOVE
```js
// patch.js
if (type === 'REMOVE') {
  const node = getNodeByPath(rootEl, path);
  highlightNode(node, true);                               // 즉시: patch-remove 클래스
  setTimeout(() => node.parentNode?.removeChild(node), 400); // 400ms 후: 실제 삭제
}
```
> 즉시 삭제하지 않고 400ms 지연 — 사용자가 무엇이 삭제되는지 시각적으로 확인 가능

---

### 2-4. 하이라이트 — `highlightNode()`

```js
// patch.js
function highlightNode(node, isRemove = false) {
  if (!node || node.nodeType === Node.TEXT_NODE) {
    // 텍스트 노드는 classList가 없으므로 부모 엘리먼트로 올라감
    if (node?.parentNode?.nodeType === Node.ELEMENT_NODE) {
      highlightNode(node.parentNode, isRemove);
    }
    return;
  }

  const className = isRemove ? 'patch-remove' : 'patch-highlight';
  node.classList?.add(className);

  setTimeout(() => {
    node.classList?.remove(className);
  }, 1200);  // 1200ms 후 자동 제거
}
```

| 상황 | 클래스 | 지속 시간 |
|------|--------|-----------|
| 노드 변경/추가 | `patch-highlight` (초록 테두리) | 1200ms |
| 노드 삭제 예정 | `patch-remove` (빨간 테두리) | 1200ms |

---

## 3. patch.test.html — 동작 방식

### 3-1. 의존 관계

```js
// patch.test.html
import { diff }                              from '../src/diff.js';
import { applyPatches }                      from '../src/patch.js';  // ← 검증 대상
import { createElement, createText, vdomToDom } from '../src/vdom.js';
```

- `diff.js` : 테스트용 패치 배열을 생성하기 위해 사용
- `patch.js` : 검증 대상, `applyPatches()`만 export되어 있음
- `vdom.js` : 테스트용 VDOM 노드 생성 및 기댓값 DOM 생성에 사용

---

### 3-2. 테스트 러너 — 큐 방식

```js
// patch.test.html
const itQueue = [];  // 실행 대기 중인 테스트 목록

function describe(name, fn) {
  const group = { name, items: [] };
  groups.push(group);
  fn();  // it() 호출들이 itQueue에 등록됨 (아직 실행 안 함)
}

function it(name, fn) {
  itQueue.push({ name, fn, group: groups[groups.length - 1] });
  // 즉시 실행하지 않고 큐에만 넣어둠
}
```

**왜 즉시 실행하지 않는가**

```
// 잘못된 방식 (async it을 describe 안에서 바로 실행)
function describe(name, fn) {
  fn();  // 내부 it()들이 async Promise를 반환하지만 await 없이 흘러감
}
async function it(name, fn) {
  await fn();  // 이 Promise는 누가 기다려 주지 않음
}
// → renderResults()가 테스트 완료 전에 실행 → 0/0 표시

// 올바른 방식 (큐에 등록 후 순서대로 await)
for (const { name, fn, group } of itQueue) {
  await fn();  // 각 테스트가 완전히 끝날 때까지 대기
}
renderResults();  // 모든 테스트 완료 후 결과 출력
```

---

### 3-3. 테스트 실행 루프

```js
// patch.test.html
for (const { name, fn, group } of itQueue) {
  try {
    await fn();   // 테스트 함수 실행 — wait(460) 같은 비동기도 정확히 대기
    passCount++;
    group.items.push({ pass: true, message: name });
  } catch (err) {
    // it() 내부에서 throw가 발생하면 실패로 기록
    failCount++;
    group.items.push({ pass: false, message: name, error: err.message });
  }
}
renderResults();  // 전부 끝난 뒤 화면에 출력
```

---

### 3-4. 모든 테스트의 공통 패턴

```js
it('테스트 이름', async () => {
  // 1단계: 변경 전/후 VDOM 정의
  const oldV = el('ul', {}, [el('li', {}, [txt('A')])]);
  const newV = el('ul', {}, [el('li', {}, [txt('A')]), el('li', {}, [txt('B')])]);

  // 2단계: 실제 DOM 생성 후 fixture에 마운트
  const root = mount(oldV);
  //   mount() → fixture.innerHTML = '' → vdomToDom(vnode) → fixture.appendChild(dom)

  // 3단계: diff로 패치 생성 → applyPatches로 실제 DOM에 반영
  applyPatches(root, diff(oldV, newV));
  //   patch.js의 applyPatches() 실행

  // 4단계: DOM 상태 검증 — 실패 시 throw, 성공 시 그냥 종료
  const items = [...root.querySelectorAll('li')].map(n => n.textContent);
  if (items.join(',') !== 'A,B')
    throw new Error(`항목이 A,B여야 합니다. 실제: ${items.join(',')}`);
});
```

---

### 3-5. 보조 헬퍼 — `userClass()`, `hasUserClass()`

**문제 상황**

```js
// patch.js의 UPDATE_PROP 처리
setDomProp(node, 'class', 'new');  // class를 'new'로 변경
highlightNode(node);               // classList.add('patch-highlight')

// 결과: node의 class = "new patch-highlight"
```

```js
// 잘못된 검증
if (root.getAttribute('class') !== 'new')  // "new patch-highlight" !== "new" → 실패!
```

**해결 방법**

```js
// patch.test.html
const HIGHLIGHT_CLASSES = ['patch-highlight', 'patch-remove'];

function userClass(el) {
  // patch-highlight, patch-remove를 제외한 나머지 class만 반환
  return [...el.classList]
    .filter(c => !HIGHLIGHT_CLASSES.includes(c))
    .join(' ') || null;
}

function hasUserClass(el) {
  // patch-highlight 외에 다른 class가 있는지 확인 (REMOVE_PROP 검증용)
  return [...el.classList].some(c => !HIGHLIGHT_CLASSES.includes(c));
}

// 올바른 검증
if (userClass(root) !== 'new')  // "new" === "new" → 통과 ✅
```

---

### 3-6. REMOVE 테스트의 비동기 처리

```js
// patch.js — REMOVE 처리
highlightNode(node, true);                                   // 즉시 실행
setTimeout(() => node.parentNode?.removeChild(node), 400);  // 400ms 후 실행

// patch.test.html — 두 시점을 나눠서 검증

// 시점 1: applyPatches 직후 (setTimeout 실행 전)
applyPatches(root, diff(oldV, newV));
const removing = root.querySelector('li[data-key="b"]');
// → 노드가 아직 DOM에 있고, patch-remove 클래스가 붙어있어야 함

// 시점 2: 400ms 경과 후
await wait(460);  // 400ms + 여유 60ms
// → 노드가 실제로 사라져야 함
if (root.querySelector('li[data-key="b"]'))
  throw new Error('지연 후에도 삭제 대상 노드가 남아 있습니다.');
```

---

## 4. patch.js ↔ patch.test.html 연동 흐름 요약

```
patch.test.html                          patch.js
──────────────────────────────────────────────────────────────

1. diff(oldV, newV)
   → 패치 배열 생성

2. applyPatches(root, patches) ──────→  applyPatches(rootEl, patches)
                                           ├─ REMOVE 추출 → 내림차순 정렬
                                           └─ applyPatch() 타입별 분기
                                               ├─ getNodeByPath() 로 노드 탐색
                                               ├─ DOM 조작 (replaceChild 등)
                                               └─ highlightNode() 로 시각화

3. (REMOVE인 경우)
   await wait(460) ───────────────────→  setTimeout(..., 400) 완료 대기

4. DOM 검증
   root.textContent
   root.getAttribute()
   root.classList
   root.querySelector()
   normalizedHtml(root)
```

---

## 5. 테스트 케이스 — patch.js 처리 대응표

| 테스트 그룹 | patch.js 실행 경로 | 검증 포인트 |
|---|---|---|
| UPDATE_TEXT | `node.textContent = value` → `highlightNode(부모)` | `textContent` 변경, `patch-highlight` 부착 |
| UPDATE_PROP | `setDomProp(node, key, value)` → `highlightNode(node)` | `getAttribute`, 불리언 속성 |
| REMOVE_PROP | `removeAttribute(key)` → `highlightNode(node)` | `hasUserClass()` 로 실제 클래스 제거 확인 |
| ADD | `insertBefore` or `appendChild` → `highlightNode(newDom)` | 노드 삽입 위치, `patch-highlight` 부착 |
| REMOVE | `highlightNode(node, true)` → `setTimeout(removeChild, 400)` | 즉시 `patch-remove`, 460ms 후 노드 소멸 |
| REPLACE | `vdomToDom(newNode)` → `replaceChild` → `highlightNode` | 기존 노드 없음, 새 노드 존재 |
