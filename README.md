# 가상 DOM & Diff 알고리즘 시각화

Virtual DOM → Diff → Patch 과정을 브라우저에서 직접 확인할 수 있는 인터랙티브 시각화 프로젝트

---

## 프로젝트 개요

DOM을 직접 수정하면 브라우저는 아래 파이프라인을 반복합니다.

```
HTML 파싱 → 스타일 계산 → 레이아웃(Reflow) → 페인트(Repaint) → 합성(Composite)
```

Virtual DOM은 **변경 전후를 비교해 필요한 부분만 갱신**함으로써 이 비용을 줄입니다.

---

## 동작 흐름

```
실제 DOM ──→ Virtual DOM (이전)
                 │
HTML 수정 ──→ Virtual DOM (이후)
                 │
             Diff 비교
                 │
             Patch 생성
                 │
             실제 DOM 반영 ──→ History 저장 (Undo/Redo)
```

---

## Diff 알고리즘

트리 간 차이를 완전히 비교하면 **트리 편집 거리(Tree Edit Distance)** 문제로, **O(n³)** 비용이 발생합니다.
이 프로젝트는 최소 편집을 보장하는 최적 diff가 아닌, **설명 가능성과 구현 명확성을 우선한 휴리스틱 기반 diff**를 구현했습니다.

### 비교 순서

```
두 노드 비교
  │
  ├─ old 없음, new 있음 → ADD
  ├─ old 있음, new 없음 → REMOVE
  ├─ type이 다름 → REPLACE
  ├─ element의 tag가 다름 → REPLACE
  │
  ├─ text node → value만 비교 → UPDATE_TEXT
  ├─ props → key 단위 비교 (plain object는 깊이 비교)
  │    ├─ 새로 추가되거나 값이 다름 → UPDATE_PROP
  │    └─ old에만 존재 → REMOVE_PROP
  │
  └─ children 비교
       ├─ key가 하나라도 있으면 → keyed mode (key map으로 매칭)
       └─ key가 없으면 → index mode (순서대로 1:1 비교)
```

### 자식 비교: keyed vs index mode

- **index mode**: old/new 자식을 순서대로 1:1 대응해 재귀 비교
- **keyed mode**: `data-key` 속성으로 key map을 만들어 동일 key끼리 매칭
  - old에만 있는 key → `REMOVE`
  - new에만 있는 key → `ADD`
  - 양쪽에 있는 key → 재귀 비교
  - common key의 **상대 순서가 달라지면** 최소 이동 계산 대신 subtree를 `REPLACE`

### Diff 처리 범위

| 조건 | Patch 타입 |
|------|-----------|
| 텍스트 내용 변경 | `UPDATE_TEXT` |
| 속성 추가/변경 | `UPDATE_PROP` |
| 속성 제거 | `REMOVE_PROP` |
| 자식 노드 추가 | `ADD` |
| 자식 노드 삭제 | `REMOVE` |
| 태그 또는 노드 타입 변경 | `REPLACE` |
| key 기반 삽입/삭제 | key map → `ADD` / `REMOVE` |
| key 순서 변경 | subtree `REPLACE` |

---

## Patch 예시

**Before:**
```html
<div id="app">
  <h1 class="header">Shopping List</h1>
  <ul>
    <li>Milk</li>
    <li><span class="highlight">Eggs</span></li>
    <li>Bread</li>
  </ul>
  <p>Total: 3</p>
</div>
```

**After:** 속성 제거, 텍스트 변경, 태그 변경, 자식 추가, 카운트 갱신
```html
<div id="app">
  <h1>Shopping List (Updated)</h1>
  <ul class="active">
    <li>Milk</li>
    <li><strong>Eggs (in stock)</strong></li>
    <li>Bread</li>
    <li>Butter</li>
  </ul>
  <p>Total: 4 - Ready</p>
</div>
```

**생성된 Patch:**
```js
[
  { type: 'REMOVE_PROP',  path: [0], key: 'class' },                     // h1의 class 제거
  { type: 'UPDATE_TEXT',  path: [0, 0], value: 'Shopping List (Updated)' }, // h1 텍스트 변경
  { type: 'UPDATE_PROP',  path: [1], key: 'class', value: 'active' },    // ul의 class 변경
  { type: 'REPLACE',      path: [1, 1, 0], newNode: 'strong>...' },       // span을 strong으로 교체
  { type: 'UPDATE_TEXT',  path: [1, 1, 0, 0], value: 'Eggs (in stock)' },// strong 내 텍스트 변경
  { type: 'ADD',          path: [1, 3], newNode: 'li>Butter' },           // li 추가
  { type: 'UPDATE_TEXT',  path: [2, 0], value: 'Total: 4 - Ready' }       // p 텍스트 변경
]
```

**처리 규칙 매핑:**
- `REMOVE_PROP`: h1의 class 속성 제거
- `UPDATE_PROP`: ul의 class 속성 변경
- `UPDATE_TEXT`: 텍스트 노드 내용 3곳 갱신
- `REPLACE`: `<span>`을 `<strong>`으로 태그 변경
- `ADD`: `<li>Butter</li>` 자식 노드 삽입

이처럼 diff는 **어떤 노드의 어떤 부분이 변했는지 정확히 기록**하고, 실제 DOM 반영은 **변경된 부분만 선택적으로 처리**합니다.

---

## 프로젝트 구조

```
src/
├── vdom.js     # VDOM 생성 및 DOM ↔ VDOM 변환
├── diff.js     # Diff 알고리즘: node / props / children 비교, key 기반 매칭
├── patch.js    # 실제 DOM 패치 적용 및 하이라이팅
├── history.js  # Undo/Redo 이력 관리
└── app.js      # UI 이벤트 및 전체 흐름 제어

tests/
├── test-runner.js     # 브라우저 기반 테스트 러너 스크립트
├── vdom.test.html     # DOM → VDOM 변환 정확성 검증
├── diff.test.html     # Diff 케이스별 patch 생성 검증
├── patch.test.html    # Patch 적용 후 실제 DOM 상태 검증
├── history.test.html  # Undo/Redo 및 상태 보존 검증
└── app.test.html      # 전체 흐름 통합 동작 검증
```

---

## 개발 프로세스

AI를 활용해 초기 MVP를 빠르게 구현한 뒤, **테스트를 품질 게이트로 두고 기능을 보정**하는 방식으로 진행했습니다.

### 검증 흐름

```
AI 코드 생성
    │
    ▼
src 모듈별 코드 리뷰 (vdom / diff / patch / history / app)
    │
    ▼
각 모듈별 테스트 케이스 작성
    │
    ▼
모듈별 테스트 실행
    │
    ▼
실패 시 원인 분석 → 버그 수정 → 재실행
    │
    ▼
테스트 전체 통과
```

### 테스트 관점

- **블랙박스 테스트**
  - HTML 변경 후 patch 결과가 올바르게 적용되는지 검증
  - Undo / Redo 이후 UI와 상태가 일관되게 유지되는지 확인
- **모듈 단위 테스트**
  - 각 모듈의 내부 로직이 의도한 입출력 규칙을 만족하는지 검증
  - 엣지 케이스에서 내부 로직이 안정적으로 동작하는지 확인
- **통합 테스트**
  - 전체 흐름(입력 → diff → patch → DOM 반영 → history)이 끊김 없이 동작하는지 검증

---

## 엣지 케이스 처리

| 케이스 | 처리 방식 |
|--------|----------|
| **공백 텍스트 노드** | `domToVdom()` 변환 시 공백-only 텍스트 노드는 무시 — 브라우저가 자동 삽입하는 whitespace가 diff에 노이즈로 잡히는 것을 방지 |
| **Boolean 속성** (`disabled`, `hidden` 등) | 값이 아닌 **존재 여부**를 기준으로 비교·반영 — `disabled=""`와 `disabled="disabled"`를 동일하게 처리 |
| **중복 key** | patch 적용 전 트리를 검사해 같은 부모 아래 중복 key가 있으면 **경고 메시지 표시 후 중단** — 잘못된 diff 결과가 DOM에 반영되는 것을 방지 |
| **keyed / non-keyed 혼용** | 자식 중 하나라도 key가 있으면 **keyed mode**로 비교, key 없는 자식은 남은 순서대로 매칭 |
| **style 속성** | HTML 입력 시 **문자열 비교**, DOM 반영 시 **객체 style 프로퍼티 단위 비교**도 지원 |
| **key 순서 변경** | 최소 이동(LIS) 계산 대신 **subtree 통째로 REPLACE** — 구현 명확성을 위한 의도적 단순화 |

---

## 실행 방법

**1. 저장소를 클론합니다.**

```bash
git clone <repository-url>
cd <repository-name>
```

**2. 프로젝트 루트에서 아래 명령어를 실행합니다.**

```bash
python -m http.server 8080
# 또는
py -m http.server 8080
```

**3. 브라우저에서 아래 주소로 접속합니다.**

```
http://localhost:8080
```
