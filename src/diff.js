// Diff 알고리즘 — 두 VDOM 트리를 비교하여 패치 배열 생성 (순수 함수, 사이드 이펙트 없음)

/**
 * 두 VNode를 비교하여 패치 배열 반환
 * @param {object} oldNode - 이전 VDOM
 * @param {object} newNode - 새 VDOM
 * @param {Array} path - 현재 노드의 경로 (인덱스 배열)
 * @returns {Array} 패치 객체 배열
 */
export function diff(oldNode, newNode, path = []) {
  const patches = [];

  // 이전 노드가 없고 새 노드가 있음 → ADD
  if (!oldNode && newNode) {
    patches.push({ type: 'ADD', path: [...path], newNode });
    return patches;
  }

  // 이전 노드가 있고 새 노드가 없음 → REMOVE
  if (oldNode && !newNode) {
    patches.push({ type: 'REMOVE', path: [...path] });
    return patches;
  }

  // 둘 다 없으면 변화 없음
  if (!oldNode && !newNode) return patches;

  // 타입이 다름 (text ↔ element) → REPLACE
  if (oldNode.type !== newNode.type) {
    patches.push({ type: 'REPLACE', path: [...path], newNode, oldNode });
    return patches;
  }

  // 텍스트 노드
  if (oldNode.type === 'text') {
    if (oldNode.value !== newNode.value) {
      patches.push({
        type: 'UPDATE_TEXT',
        path: [...path],
        value: newNode.value,
        oldValue: oldNode.value,
      });
    }
    return patches;
  }

  // 엘리먼트 노드 — 태그가 다름 → REPLACE
  if (oldNode.tag !== newNode.tag) {
    patches.push({ type: 'REPLACE', path: [...path], newNode, oldNode });
    return patches;
  }

  // Props 비교
  const propPatches = diffProps(oldNode.props || {}, newNode.props || {}, path);
  patches.push(...propPatches);

  // 자식 노드 비교
  const childPatches = diffChildren(oldNode.children || [], newNode.children || [], path);
  patches.push(...childPatches);

  return patches;
}

/**
 * Props 비교
 */
function diffProps(oldProps, newProps, path) {
  const patches = [];

  // 변경되거나 추가된 props
  for (const [key, value] of Object.entries(newProps)) {
    if (!(key in oldProps)) {
      patches.push({ type: 'UPDATE_PROP', path: [...path], key, value, oldValue: undefined });
    } else if (oldProps[key] !== value) {
      patches.push({ type: 'UPDATE_PROP', path: [...path], key, value, oldValue: oldProps[key] });
    }
  }

  // 제거된 props
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      patches.push({ type: 'REMOVE_PROP', path: [...path], key, oldValue: oldProps[key] });
    }
  }

  return patches;
}

/**
 * 자식 노드 배열 비교 — key 기반 매칭 후 인덱스 기반 fallback
 */
function diffChildren(oldChildren, newChildren, parentPath) {
  const patches = [];

  // key를 가진 노드와 그렇지 않은 노드를 분리
  const oldKeyed = buildKeyMap(oldChildren);
  const newKeyed = buildKeyMap(newChildren);

  const hasAnyKey = oldKeyed.size > 0 || newKeyed.size > 0;

  if (hasAnyKey) {
    patches.push(...diffKeyedChildren(oldChildren, newChildren, parentPath, oldKeyed, newKeyed));
  } else {
    patches.push(...diffIndexedChildren(oldChildren, newChildren, parentPath));
  }

  return patches;
}

/**
 * key가 있는 자식 노드 비교
 */
function diffKeyedChildren(oldChildren, newChildren, parentPath, oldKeyed, newKeyed) {
  const patches = [];

  // key 없는 노드를 위한 인덱스 카운터
  let oldUnkeyedIdx = 0;
  let newUnkeyedIdx = 0;

  const oldUnkeyed = oldChildren.filter(c => !getKey(c));
  const newUnkeyed = newChildren.filter(c => !getKey(c));

  // 새 자식 순서 기준으로 순회
  const newOrder = []; // { key, vnode, oldIdx }

  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = getKey(newChild);

    if (key !== null) {
      newOrder.push({ key, vnode: newChild, newIdx: i });
    } else {
      newOrder.push({ key: null, vnode: newChild, newIdx: i });
    }
  }

  // 이전에 있었지만 새로 없어진 keyed 노드 → REMOVE
  for (const [key] of oldKeyed) {
    if (!newKeyed.has(key)) {
      const { index } = oldKeyed.get(key);
      patches.push({ type: 'REMOVE', path: [...parentPath, index] });
    }
  }

  // 각 새 자식에 대해 diff
  let processedUnkeyed = 0;
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = getKey(newChild);
    const childPath = [...parentPath, i];

    if (key !== null) {
      if (oldKeyed.has(key)) {
        const { vnode: oldChild } = oldKeyed.get(key);
        const childPatches = diff(oldChild, newChild, childPath);
        patches.push(...childPatches);
      } else {
        // 새로 추가된 keyed 노드
        patches.push({ type: 'ADD', path: childPath, newNode: newChild });
      }
    } else {
      // key 없는 노드 → 인덱스 순서로 매칭
      const oldChild = oldUnkeyed[processedUnkeyed];
      if (oldChild) {
        patches.push(...diff(oldChild, newChild, childPath));
      } else {
        patches.push({ type: 'ADD', path: childPath, newNode: newChild });
      }
      processedUnkeyed++;
    }
  }

  // key 없는 이전 노드 중 남은 것 → REMOVE
  for (let i = processedUnkeyed; i < oldUnkeyed.length; i++) {
    patches.push({ type: 'REMOVE', path: [...parentPath, newChildren.length + i] });
  }

  return patches;
}

/**
 * key 없는 자식 노드 인덱스 기반 비교
 */
function diffIndexedChildren(oldChildren, newChildren, parentPath) {
  const patches = [];
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = [...parentPath, i];
    const childPatches = diff(oldChildren[i] || null, newChildren[i] || null, childPath);
    patches.push(...childPatches);
  }

  return patches;
}

/**
 * key맵 생성: key → { vnode, index }
 */
function buildKeyMap(children) {
  const map = new Map();
  children.forEach((child, i) => {
    const key = getKey(child);
    if (key !== null) map.set(key, { vnode: child, index: i });
  });
  return map;
}

/**
 * VNode에서 key 추출
 */
function getKey(vnode) {
  if (!vnode) return null;
  if (vnode.type === 'text') return null;
  return vnode.key ?? vnode.props?.['data-key'] ?? null;
}
