// UI 초기화 및 이벤트 바인딩

import { domToVdom, vdomToDom, cloneVdom } from './vdom.js';
import { diff } from './diff.js';
import { applyPatches } from './patch.js';
import { History } from './history.js';

// 초기 샘플 HTML
const INITIAL_HTML = `<div id="app">
  <h1>Shopping List</h1>
  <ul>
    <li class="done" data-key="item-1">Milk</li>
    <li data-key="item-2">Eggs</li>
    <li data-key="item-3">Bread</li>
  </ul>
  <p class="count">3 items</p>
</div>`;

// 전역 상태
let currentVdom = null;
let htmlSnapshots = [];
let alertTimer = null;
const history = new History();

// DOM 참조
let realArea, testArea, patchBtn, undoBtn, redoBtn, diffLog, vdomTree, historyInfo, appAlert;

/**
 * 앱 초기화
 */
export function init() {
  realArea = document.getElementById('real-area');
  testArea = document.getElementById('test-area');
  patchBtn = document.getElementById('btn-patch');
  undoBtn = document.getElementById('btn-undo');
  redoBtn = document.getElementById('btn-redo');
  diffLog = document.getElementById('diff-log');
  vdomTree = document.getElementById('vdom-tree');
  historyInfo = document.getElementById('history-info');
  appAlert = document.getElementById('app-alert');

  const initialHtml = INITIAL_HTML.trim();

  // 초기 렌더링
  const parser = new DOMParser();
  const doc = parser.parseFromString(initialHtml, 'text/html');
  const appEl = doc.body.firstElementChild;

  currentVdom = domToVdom(appEl);
  history.push(currentVdom);
  htmlSnapshots = [initialHtml];

  // 실제 영역 렌더링
  realArea.innerHTML = '';
  realArea.appendChild(vdomToDom(currentVdom));

  // 테스트 영역: HTML 소스 코드로 편집
  testArea.value = initialHtml;

  // 버튼 이벤트
  patchBtn.addEventListener('click', onPatch);
  undoBtn.addEventListener('click', onUndo);
  redoBtn.addEventListener('click', onRedo);

  updateUI();
  renderVdomTree(currentVdom, null);
  setDiffLog([]);
}

/**
 * Patch 버튼 처리
 */
function onPatch() {
  const htmlSource = testArea.value.trim();
  if (!htmlSource) return;

  // 새 VDOM 생성
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlSource, 'text/html');
  const appEl = doc.body.firstElementChild;
  if (!appEl) {
    showAlert('유효한 HTML을 입력해주세요.');
    return;
  }

  const newVdom = domToVdom(appEl);
  const duplicateKeyError = findDuplicateKeyError(newVdom);
  if (duplicateKeyError) {
    showAlert(duplicateKeyError);
    return;
  }

  // Diff
  const patches = diff(currentVdom, newVdom);

  // Patch 적용
  applyPatches(realArea.firstElementChild || realArea, patches);

  // 히스토리 저장
  const prevVdom = cloneVdom(currentVdom);
  currentVdom = newVdom;
  history.push(currentVdom);
  htmlSnapshots = htmlSnapshots.slice(0, history.cursor);
  htmlSnapshots.push(htmlSource);
  testArea.value = htmlSource;

  // UI 갱신
  updateUI();
  setDiffLog(patches);
  renderVdomTree(currentVdom, prevVdom);
}

function showAlert(message) {
  if (!appAlert) return;

  appAlert.textContent = message;
  appAlert.hidden = false;

  if (alertTimer) {
    clearTimeout(alertTimer);
  }

  alertTimer = window.setTimeout(() => {
    appAlert.hidden = true;
    alertTimer = null;
  }, 3200);
}

function findDuplicateKeyError(vnode, path = 'root') {
  if (!vnode || vnode.type !== 'element') return null;

  const seenKeys = new Map();
  for (const child of vnode.children || []) {
    if (!child || child.type !== 'element' || child.key == null) continue;

    if (seenKeys.has(child.key)) {
      return `같은 부모 아래 data-key는 유일해야 합니다. "${child.key}"가 ${path}에서 중복되었습니다.`;
    }

    seenKeys.set(child.key, true);
  }

  for (const [index, child] of (vnode.children || []).entries()) {
    const childPath = `${path} > ${child?.tag ?? child?.type ?? index}[${index}]`;
    const nestedError = findDuplicateKeyError(child, childPath);
    if (nestedError) return nestedError;
  }

  return null;
}

/**
 * Undo 처리
 */
function onUndo() {
  const prevVdom = history.undo();
  if (!prevVdom) return;

  const oldVdom = cloneVdom(currentVdom);
  currentVdom = prevVdom;

  const patches = diff(oldVdom, currentVdom);
  applyPatches(realArea.firstElementChild || realArea, patches);
  testArea.value = htmlSnapshots[history.cursor] ?? '';

  updateUI();
  setDiffLog(patches);
  renderVdomTree(currentVdom, oldVdom);
}

/**
 * Redo 처리
 */
function onRedo() {
  const nextVdom = history.redo();
  if (!nextVdom) return;

  const oldVdom = cloneVdom(currentVdom);
  currentVdom = nextVdom;

  const patches = diff(oldVdom, currentVdom);
  applyPatches(realArea.firstElementChild || realArea, patches);
  testArea.value = htmlSnapshots[history.cursor] ?? '';

  updateUI();
  setDiffLog(patches);
  renderVdomTree(currentVdom, oldVdom);
}

/**
 * 버튼 활성/비활성 상태 갱신
 */
function updateUI() {
  undoBtn.disabled = !history.canUndo();
  redoBtn.disabled = !history.canRedo();
  historyInfo.textContent = `히스토리: ${history.cursor + 1} / ${history.size}`;
}

/**
 * Diff 로그 패널 렌더링
 */
function setDiffLog(patches) {
  if (patches.length === 0) {
    diffLog.innerHTML = '<div class="log-empty">변경사항 없음 (패치 없음)</div>';
    return;
  }

  const html = patches.map((p, i) => {
    const pathStr = p.path.length ? p.path.join(' → ') : '(루트)';
    let detail = '';

    switch (p.type) {
      case 'UPDATE_TEXT':
        detail = `<span class="log-old">"${escHtml(p.oldValue)}"</span> → <span class="log-new">"${escHtml(p.value)}"</span>`;
        break;
      case 'UPDATE_PROP':
        detail = `<code>${escHtml(p.key)}</code>: <span class="log-old">${escHtml(String(p.oldValue ?? '(없음)'))}</span> → <span class="log-new">${escHtml(String(p.value))}</span>`;
        break;
      case 'REMOVE_PROP':
        detail = `<code>${escHtml(p.key)}</code> 제거 (이전: <span class="log-old">${escHtml(String(p.oldValue))}</span>)`;
        break;
      case 'REPLACE':
        detail = `<span class="log-old">&lt;${p.oldNode?.tag ?? '?'}&gt;</span> → <span class="log-new">&lt;${p.newNode?.tag ?? '?'}&gt;</span>`;
        break;
      case 'ADD':
        detail = `<span class="log-new">&lt;${p.newNode?.tag ?? '텍스트'}&gt; 추가</span>`;
        break;
      case 'REMOVE':
        detail = `<span class="log-old">노드 제거</span>`;
        break;
    }

    return `<div class="log-item">
      <span class="log-index">#${i + 1}</span>
      <span class="log-type log-type-${p.type.toLowerCase().replace('_', '-')}">${p.type}</span>
      <span class="log-path">경로: [${pathStr}]</span>
      <span class="log-detail">${detail}</span>
    </div>`;
  }).join('');

  diffLog.innerHTML = html;
}

/**
 * VDOM 트리 시각화
 */
function renderVdomTree(vdom, prevVdom) {
  if (!vdom) {
    vdomTree.innerHTML = '<div class="tree-empty">VDOM 없음</div>';
    return;
  }

  // diff 결과로 변경된 경로 수집
  const changedPaths = new Set();
  if (prevVdom) {
    const patches = diff(prevVdom, vdom);
    patches.forEach(p => changedPaths.add(p.path.join(',')));
  }

  vdomTree.innerHTML = renderTreeNode(vdom, [], changedPaths);
}

/**
 * VNode를 트리 HTML로 변환 (재귀)
 */
function renderTreeNode(vnode, path, changedPaths) {
  if (!vnode) return '';
  const pathKey = path.join(',');
  const isChanged = changedPaths.has(pathKey);
  const changedClass = isChanged ? ' tree-changed' : '';

  if (vnode.type === 'text') {
    return `<div class="tree-node tree-text${changedClass}">
      <span class="tree-icon">T</span>
      <span class="tree-text-value">"${escHtml(vnode.value)}"</span>
    </div>`;
  }

  const propsStr = Object.entries(vnode.props || {})
    .map(([k, v]) => `<span class="tree-prop"><span class="tree-prop-key">${escHtml(k)}</span>="<span class="tree-prop-val">${escHtml(v)}</span>"</span>`)
    .join(' ');

  const keyBadge = vnode.key ? `<span class="tree-key-badge">key:${escHtml(vnode.key)}</span>` : '';

  const children = (vnode.children || [])
    .map((child, i) => renderTreeNode(child, [...path, i], changedPaths))
    .join('');

  const hasChildren = vnode.children && vnode.children.length > 0;

  return `<div class="tree-node tree-element${changedClass}">
    <div class="tree-tag">
      <span class="tree-icon">E</span>
      <span class="tree-tagname">&lt;${escHtml(vnode.tag)}&gt;</span>
      ${keyBadge}
      ${propsStr ? `<span class="tree-props">${propsStr}</span>` : ''}
    </div>
    ${hasChildren ? `<div class="tree-children">${children}</div>` : ''}
  </div>`;
}

/**
 * HTML 이스케이프
 */
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
