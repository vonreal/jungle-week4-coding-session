// 간단한 브라우저 기반 테스트 러너

let passCount = 0;
let failCount = 0;
const results = [];

/**
 * 단언 함수
 */
export function assert(condition, message) {
  if (condition) {
    passCount++;
    results.push({ pass: true, message });
  } else {
    failCount++;
    results.push({ pass: false, message });
    console.error(`❌ FAIL: ${message}`);
  }
}

/**
 * 두 값이 깊이 동일한지 비교
 */
export function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
}

export function assertEqual(actual, expected, message) {
  const pass = deepEqual(actual, expected);
  if (!pass) {
    console.error(`❌ FAIL: ${message}`);
    console.error('  actual  :', JSON.stringify(actual, null, 2));
    console.error('  expected:', JSON.stringify(expected, null, 2));
  }
  assert(pass, message);
}

/**
 * 테스트 그룹
 */
export function describe(name, fn) {
  console.group(`📦 ${name}`);
  fn();
  console.groupEnd();
}

/**
 * 테스트 케이스
 */
export function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failCount++;
    results.push({ pass: false, message: name, error: e.message });
    console.error(`  ❌ ${name}: ${e.message}`);
  }
}

/**
 * 결과를 DOM에 렌더링
 */
export function renderResults() {
  const container = document.getElementById('test-results');
  if (!container) return;

  const total = passCount + failCount;
  const allPass = failCount === 0;

  container.innerHTML = `
    <div class="summary ${allPass ? 'all-pass' : 'has-fail'}">
      <span class="summary-icon">${allPass ? '🎉' : '⚠️'}</span>
      <strong>${passCount}/${total} 통과</strong>
      ${failCount > 0 ? `<span class="fail-count">${failCount}개 실패</span>` : ''}
    </div>
    <div class="result-list">
      ${results.map(r => `
        <div class="result-item ${r.pass ? 'pass' : 'fail'}">
          <span class="result-icon">${r.pass ? '✅' : '❌'}</span>
          <span class="result-msg">${r.message}</span>
          ${r.error ? `<span class="result-error">${r.error}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
