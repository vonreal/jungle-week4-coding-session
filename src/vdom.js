// VDOM 노드 생성 및 DOM↔VDOM 변환 모듈

/**
 * 엘리먼트 VNode 생성
 */
export function createElement(tag, props = {}, children = [], key = null) {
  return {
    type: 'element',
    tag: tag.toLowerCase(),
    props: { ...props },
    key: key ?? props['data-key'] ?? null,
    children: children.map(normalizeChild),
  };
}

/**
 * 텍스트 VNode 생성
 */
export function createText(value) {
  return {
    type: 'text',
    value: String(value),
  };
}

/**
 * 자식 노드를 VNode 형태로 정규화
 */
function normalizeChild(child) {
  if (child === null || child === undefined) return createText('');
  if (typeof child === 'string' || typeof child === 'number') return createText(String(child));
  return child;
}

/**
 * 실제 DOM 노드 → VDOM 변환
 * data-key 속성을 key로 사용
 */
export function domToVdom(node) {
  if (!node) return null;

  // 텍스트 노드
  if (node.nodeType === Node.TEXT_NODE) {
    return createText(node.textContent);
  }

  // 엘리먼트 노드
  if (node.nodeType === Node.ELEMENT_NODE) {
    const props = {};
    for (const attr of node.attributes) {
      props[attr.name] = attr.value;
    }

    const key = props['data-key'] ?? null;

    const children = [];
    for (const child of node.childNodes) {
      const vchild = domToVdom(child);
      if (vchild !== null) {
        // 순수 공백 텍스트 노드는 제외
        if (vchild.type === 'text' && vchild.value !== '' && vchild.value.trim() === '') continue;
        children.push(vchild);
      }
    }

    return {
      type: 'element',
      tag: node.tagName.toLowerCase(),
      props,
      key,
      children,
    };
  }

  return null;
}

/**
 * VDOM → 실제 DOM 노드 생성
 */
export function vdomToDom(vnode) {
  if (!vnode) return document.createTextNode('');

  if (vnode.type === 'text') {
    return document.createTextNode(vnode.value);
  }

  const el = document.createElement(vnode.tag);

  // props 적용
  for (const [key, value] of Object.entries(vnode.props || {})) {
    setDomProp(el, key, value);
  }

  // 자식 노드 생성
  for (const child of vnode.children || []) {
    el.appendChild(vdomToDom(child));
  }

  return el;
}

/**
 * DOM 속성 설정 (불리언 속성 포함)
 */
export function setDomProp(el, key, value) {
  const booleanAttrs = ['disabled', 'checked', 'readonly', 'selected', 'multiple', 'autofocus', 'hidden'];
  if (booleanAttrs.includes(key)) {
    if (value === false || value === 'false' || value === null || value === undefined) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, '');
    }
  } else if (key === 'style' && typeof value === 'object') {
    Object.assign(el.style, value);
  } else {
    el.setAttribute(key, value);
  }
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, cloneValue(nestedValue)])
    );
  }

  return value;
}

/**
 * VDOM 깊은 복사
 */
export function cloneVdom(vnode) {
  if (!vnode) return null;
  if (vnode.type === 'text') return { type: 'text', value: vnode.value };
  return {
    type: 'element',
    tag: vnode.tag,
    props: cloneValue(vnode.props || {}),
    key: vnode.key,
    children: (vnode.children || []).map(cloneVdom),
  };
}
