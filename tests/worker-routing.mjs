// Worker 路由层测试：API 路径永不返回 HTML（SPA 兜底），缺 KV 绑定时给明确 JSON 错误
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const INDEX_HTML = '<!DOCTYPE html><html><body>spa-fallback</body></html>';

// 模拟 Assets 绑定：任何请求都回 index.html（模拟 SPA not_found_handling）
const envWithAssets = {
  ASSETS: { fetch: () => new Response(INDEX_HTML, { status: 200, headers: { 'content-type': 'text/html' } }) },
};

// 带 KV 桩的环境（用于测"路由未命中"这类与 KV 无关的分支）
const envFull = {
  ASSETS: envWithAssets.ASSETS,
  SUB_STORE: { list: async () => ({ keys: [], list_complete: true }) },
};

async function get(pathname, env) {
  return worker.fetch(new Request(`https://worker.test${pathname}`), env ?? envWithAssets, {});
}

// 1) 缺 SUB_STORE 绑定时：必须是 JSON 错误，不能 500 崩或返回 HTML
{
  const res = await get('/api/history', { ASSETS: envWithAssets.ASSETS });
  const body = await res.json(); // 若返回 HTML 这里直接抛 "Unexpected token '<'"
  assert.equal(res.status >= 400, true, `/api/history 缺 KV 应返回错误状态，实际 ${res.status}`);
  assert.equal(body.ok, false, '缺 KV 时 body.ok 应为 false');
  assert.ok(body.error, '缺 KV 时应带 error 说明');
}

// 2) 未命中的 /api/* 路由：必须 JSON 404，不能落到 SPA 兜底返回 index.html
{
  const res = await get('/api/nonexistent', envFull);
  assert.notEqual(res.headers.get('content-type') || '', '', '响应应有 content-type');
  assert.ok(res.headers.get('content-type').includes('json'), `/api/* 未命中应返回 JSON，实际 ${res.headers.get('content-type')}`);
  assert.equal(res.status, 404, `/api/* 未命中应 404，实际 ${res.status}`);
  const body = await res.json();
  assert.equal(body.ok, false);
}

// 3) 非 API 路径仍走静态资源 SPA 兜底（现有行为不能被破坏）
{
  const res = await get('/some/spa/route');
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('spa-fallback'), '非 API 路径应照常落到 ASSETS');
}

// 4) /sub/* 缺 KV 同样给 JSON 错误
{
  const res = await get('/sub/abc123');
  const body = await res.json();
  assert.equal(res.status >= 400, true);
  assert.equal(body.ok, false);
}

console.log('worker-routing: all assertions passed');
