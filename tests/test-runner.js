// 간단한 브라우저 기반 테스트 러너

let passCount = 0;
let failCount = 0;
const results = [];
let currentTestName = '';

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function ensureRunnerStyles() {
  if (document.getElementById('test-runner-styles')) return;

  const style = document.createElement('style');
  style.id = 'test-runner-styles';
  style.textContent = `
    .result-detail-toggle {
      margin-top: 10px;
      padding-top: 10px;
    }
    .result-detail-toggle summary {
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #2952cc;
      background: #eef3ff;
      border: 1px solid #c8d5ff;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      font-weight: 700;
      user-select: none;
      outline: none;
      list-style: none;
    }
    .result-detail-toggle summary::-webkit-details-marker { display: none; }
    .result-detail-toggle[open] summary {
      margin-bottom: 10px;
    }
    .result-detail-toggle summary::before {
      content: '▶';
      font-size: 10px;
    }
    .result-detail-toggle[open] summary::before {
      content: '▼';
    }
    .detail-block {
      margin-top: 8px;
    }
    .detail-compare-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
    }
    .detail-compare-grid .detail-block {
      margin-top: 0;
    }
    .detail-label {
      display: block;
      margin-bottom: 4px;
      color: #6b7280;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .detail-code {
      white-space: pre-wrap;
      word-break: break-word;
      background: #f8fafc;
      border: 1px solid #d7deea;
      border-radius: 6px;
      padding: 10px 12px;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.55;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
    }
    .detail-tip {
      white-space: pre-wrap;
      word-break: break-word;
      background: rgba(15, 157, 122, 0.08);
      border: 1px solid rgba(15, 157, 122, 0.25);
      border-left: 4px solid rgba(15, 157, 122, 0.55);
      border-radius: 8px;
      padding: 10px 12px;
      color: #155e4b;
      font-size: 12px;
      line-height: 1.6;
      font-family: 'Pretendard', system-ui, sans-serif;
    }
  `;

  document.head.appendChild(style);
}

function buildDetails(details) {
  if (!details) return '';

  const inputEntry = details.input !== undefined
    ? ['입력값', details.input, 'code']
    : null;
  const expectedEntry = details.expected !== undefined
    ? ['예상값', details.expected, 'code']
    : null;
  const actualEntry = details.actual !== undefined
    ? ['실제값', details.actual, 'code']
    : null;
  const tipEntry = details.reactCompare !== undefined
    ? ['실무/현업 관점', details.reactCompare, 'tip']
    : null;

  if (!inputEntry && !expectedEntry && !actualEntry && !tipEntry) return '';

  const renderEntry = ([label, value, variant]) => `
    <div class="detail-block">
      <span class="detail-label">${label}</span>
      ${variant === 'tip'
        ? `<div class="detail-tip">${escapeHtml(formatValue(value))}</div>`
        : `<pre class="detail-code">${escapeHtml(formatValue(value))}</pre>`}
    </div>
  `;

  return `
    <details class="result-detail-toggle">
      <summary>자세히 보기</summary>
      ${inputEntry ? renderEntry(inputEntry) : ''}
      ${(expectedEntry || actualEntry) ? `
        <div class="detail-compare-grid">
          ${expectedEntry ? renderEntry(expectedEntry) : ''}
          ${actualEntry ? renderEntry(actualEntry) : ''}
        </div>
      ` : ''}
      ${tipEntry ? renderEntry(tipEntry) : ''}
    </details>
  `;
}

/**
 * 단언 함수
 */
export function assert(condition, message, details = null) {
  if (condition) {
    passCount++;
    results.push({ pass: true, message, testName: currentTestName, details });
  } else {
    failCount++;
    results.push({ pass: false, message, testName: currentTestName, details });
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

export function assertEqual(actual, expected, message, details = null) {
  const pass = deepEqual(actual, expected);
  if (!pass) {
    console.error(`❌ FAIL: ${message}`);
    console.error('  actual  :', JSON.stringify(actual, null, 2));
    console.error('  expected:', JSON.stringify(expected, null, 2));
  }
  assert(pass, message, {
    ...details,
    expected,
    actual,
  });
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
    currentTestName = name;
    fn();
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failCount++;
    results.push({ pass: false, message: name, testName: name, error: e.message });
    console.error(`  ❌ ${name}: ${e.message}`);
  } finally {
    currentTestName = '';
  }
}

/**
 * 결과를 DOM에 렌더링
 */
export function renderResults() {
  const container = document.getElementById('test-results');
  if (!container) return;
  ensureRunnerStyles();

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
          <div class="result-msg">
            <div>${r.message}</div>
            ${buildDetails(r.details)}
          </div>
          ${r.error ? `<span class="result-error">${r.error}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}
