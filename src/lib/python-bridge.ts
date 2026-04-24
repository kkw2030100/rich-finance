import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const ENGINE_DIR = '/Users/kkw2030100/projects/stock-brain-engine';
const PYTHON = join(ENGINE_DIR, 'venv', 'bin', 'python3');

/**
 * Python 엔진 함수를 호출하고 JSON 결과를 반환
 * 임시 .py 파일을 생성하여 실행 (쉘 이스케이프 문제 방지)
 */
export function callPython(code: string, timeoutMs = 30000): unknown {
  const tmpFile = join(tmpdir(), `richgo_py_${Date.now()}.py`);

  const fullCode = `import sys, json
sys.path.insert(0, '${ENGINE_DIR}')
${code}
`;

  writeFileSync(tmpFile, fullCode, 'utf-8');

  try {
    const result = execSync(`${PYTHON} ${tmpFile}`, {
      cwd: ENGINE_DIR,
      timeout: timeoutMs,
      encoding: 'utf-8',
      env: { ...process.env, PYTHONPATH: ENGINE_DIR },
    });

    return JSON.parse(result.trim());
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}
