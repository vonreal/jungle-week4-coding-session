// 패치 적용 모듈 — 실제 DOM에 패치를 적용하고 변경된 노드를 하이라이트

import { vdomToDom, setDomProp } from './vdom.js';

/**
 * 패치 배열을 실제 DOM에 적용
 * @param {Element} rootEl - 패치를 적용할 루트 DOM 엘리먼트
 * @param {Array} patches - diff()가 반환한 패치 배열
 */
export function applyPatches(rootEl, patches) {
  // REMOVE 패치는 역순으로 처리 (인덱스 밀림 방지)
  const removes = patches.filter(p => p.type === 'REMOVE');
  const others = patches.filter(p => p.type !== 'REMOVE');

  // REMOVE는 path 내림차순 처리
  const sortedRemoves = [...removes].sort((a, b) => {
    const aLast = a.path[a.path.length - 1] ?? 0;
    const bLast = b.path[b.path.length - 1] ?? 0;
    return bLast - aLast;
  });

  for (const patch of sortedRemoves) {
    applyPatch(rootEl, patch);
  }

  for (const patch of others) {
    applyPatch(rootEl, patch);
  }
}

/**
 * 단일 패치 적용
 */
function applyPatch(rootEl, patch) {
  const { type, path } = patch;

  if (type === 'REPLACE') {
    const node = getNodeByPath(rootEl, path);
    if (!node) return;
    const newDom = vdomToDom(patch.newNode);
    node.parentNode?.replaceChild(newDom, node);
    highlightNode(newDom);
    return;
  }

  if (type === 'UPDATE_TEXT') {
    const node = getNodeByPath(rootEl, path);
    if (!node) return;
    node.textContent = patch.value;
    highlightNode(node.parentNode || node);
    return;
  }

  if (type === 'UPDATE_PROP') {
    const node = getNodeByPath(rootEl, path);
    if (!node) return;
    setDomProp(node, patch.key, patch.value);
    highlightNode(node);
    return;
  }

  if (type === 'REMOVE_PROP') {
    const node = getNodeByPath(rootEl, path);
    if (!node) return;
    node.removeAttribute(patch.key);
    highlightNode(node);
    return;
  }

  if (type === 'ADD') {
    // path의 마지막 요소가 자식 인덱스
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1];
    const parent = parentPath.length === 0 ? rootEl : getNodeByPath(rootEl, parentPath);
    if (!parent) return;

    const newDom = vdomToDom(patch.newNode);

    // 의미있는 자식만 기준으로 인덱스 계산 (공백 텍스트 노드 제외)
    const significantChildren = getSignificantChildren(parent);
    const refNode = significantChildren[childIndex] ?? null;

    if (refNode) {
      parent.insertBefore(newDom, refNode);
    } else {
      parent.appendChild(newDom);
    }
    highlightNode(newDom);
    return;
  }

  if (type === 'REMOVE') {
    const node = getNodeByPath(rootEl, path);
    if (!node) return;
    highlightNode(node, true);
    // 하이라이트 후 제거
    setTimeout(() => node.parentNode?.removeChild(node), 400);
    return;
  }
}

/**
 * path 배열로 DOM 노드 탐색
 * path = [0, 1, 2] → rootEl의 0번 자식의 1번 자식의 2번 자식
 */
function getNodeByPath(rootEl, path) {
  if (!path || path.length === 0) return rootEl;

  let current = rootEl;
  for (const idx of path) {
    if (!current) return null;
    // childNodes에서 공백 텍스트를 제외하고 의미있는 노드만 인덱싱
    const children = getSignificantChildren(current);
    current = children[idx] ?? null;
  }
  return current;
}

/**
 * 의미있는 자식 노드만 반환 (순수 공백 텍스트 제외)
 */
function getSignificantChildren(node) {
  return Array.from(node.childNodes).filter(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      return child.textContent.trim() !== '';
    }
    return true;
  });
}

/**
 * 변경된 DOM 노드 하이라이트 (CSS 클래스 기반)
 */
function highlightNode(node, isRemove = false) {
  if (!node || node.nodeType === Node.TEXT_NODE) {
    // 텍스트 노드이면 부모 엘리먼트를 하이라이트
    if (node?.parentNode?.nodeType === Node.ELEMENT_NODE) {
      highlightNode(node.parentNode, isRemove);
    }
    return;
  }

  const className = isRemove ? 'patch-remove' : 'patch-highlight';
  node.classList?.add(className);

  setTimeout(() => {
    node.classList?.remove(className);
  }, 1200);
}
