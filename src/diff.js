// Diff algorithm: compare two VDOM trees and return a patch list.

/**
 * Compare two VNodes and return patch objects.
 * @param {object} oldNode
 * @param {object} newNode
 * @param {Array} path
 * @returns {Array}
 */
export function diff(oldNode, newNode, path = []) {
  const patches = [];

  if (!oldNode && newNode) {
    patches.push({ type: 'ADD', path: [...path], newNode });
    return patches;
  }

  if (oldNode && !newNode) {
    patches.push({ type: 'REMOVE', path: [...path] });
    return patches;
  }

  if (!oldNode && !newNode) return patches;

  if (oldNode.type !== newNode.type) {
    patches.push({ type: 'REPLACE', path: [...path], newNode, oldNode });
    return patches;
  }

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

  if (oldNode.tag !== newNode.tag) {
    patches.push({ type: 'REPLACE', path: [...path], newNode, oldNode });
    return patches;
  }

  patches.push(...diffProps(oldNode.props || {}, newNode.props || {}, path));
  patches.push(...diffChildren(oldNode.children || [], newNode.children || [], path));

  return patches;
}

function diffProps(oldProps, newProps, path) {
  const patches = [];

  for (const [key, value] of Object.entries(newProps)) {
    if (!(key in oldProps)) {
      patches.push({ type: 'UPDATE_PROP', path: [...path], key, value, oldValue: undefined });
    } else if (!isEqualPropValue(oldProps[key], value)) {
      patches.push({ type: 'UPDATE_PROP', path: [...path], key, value, oldValue: oldProps[key] });
    }
  }

  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      patches.push({ type: 'REMOVE_PROP', path: [...path], key, oldValue: oldProps[key] });
    }
  }

  return patches;
}

function diffChildren(oldChildren, newChildren, parentPath) {
  const patches = [];

  const oldKeyed = buildKeyMap(oldChildren);
  const newKeyed = buildKeyMap(newChildren);
  const hasAnyKey = oldKeyed.size > 0 || newKeyed.size > 0;

  if (hasAnyKey) {
    patches.push(...diffKeyedChildren(oldChildren, newChildren, parentPath, oldKeyed));
  } else {
    patches.push(...diffIndexedChildren(oldChildren, newChildren, parentPath));
  }

  return patches;
}

function diffKeyedChildren(oldChildren, newChildren, parentPath, oldKeyed) {
  const patches = [];
  const oldUnkeyed = oldChildren.filter(child => getKey(child) === null);
  const oldKeyBuckets = cloneKeyBuckets(oldKeyed);

  let processedUnkeyed = 0;

  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = getKey(newChild);
    const childPath = [...parentPath, i];

    if (key !== null) {
      const oldMatches = oldKeyBuckets.get(key);

      if (oldMatches && oldMatches.length > 0) {
        // Consume from the end so earlier duplicate keys remain removable.
        const { vnode: oldChild } = oldMatches.pop();
        patches.push(...diff(oldChild, newChild, childPath));
      } else {
        patches.push({ type: 'ADD', path: childPath, newNode: newChild });
      }
    } else {
      const oldChild = oldUnkeyed[processedUnkeyed];

      if (oldChild) {
        patches.push(...diff(oldChild, newChild, childPath));
      } else {
        patches.push({ type: 'ADD', path: childPath, newNode: newChild });
      }

      processedUnkeyed++;
    }
  }

  for (const matches of oldKeyBuckets.values()) {
    for (const { index } of matches) {
      patches.push({ type: 'REMOVE', path: [...parentPath, index] });
    }
  }

  for (let i = processedUnkeyed; i < oldUnkeyed.length; i++) {
    patches.push({ type: 'REMOVE', path: [...parentPath, newChildren.length + i] });
  }

  return patches;
}

function diffIndexedChildren(oldChildren, newChildren, parentPath) {
  const patches = [];
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const childPath = [...parentPath, i];
    patches.push(...diff(oldChildren[i] || null, newChildren[i] || null, childPath));
  }

  return patches;
}

function buildKeyMap(children) {
  const map = new Map();

  children.forEach((child, index) => {
    const key = getKey(child);

    if (key !== null) {
      const matches = map.get(key) || [];
      matches.push({ vnode: child, index });
      map.set(key, matches);
    }
  });

  return map;
}

function cloneKeyBuckets(keyMap) {
  const cloned = new Map();

  for (const [key, matches] of keyMap.entries()) {
    cloned.set(key, [...matches]);
  }

  return cloned;
}

function isEqualPropValue(oldValue, newValue) {
  if (oldValue === newValue) return true;

  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const oldKeys = Object.keys(oldValue);
    const newKeys = Object.keys(newValue);

    if (oldKeys.length !== newKeys.length) return false;

    for (const key of oldKeys) {
      if (!(key in newValue)) return false;
      if (!isEqualPropValue(oldValue[key], newValue[key])) return false;
    }

    return true;
  }

  return false;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getKey(vnode) {
  if (!vnode) return null;
  if (vnode.type === 'text') return null;
  return vnode.key ?? vnode.props?.['data-key'] ?? null;
}
