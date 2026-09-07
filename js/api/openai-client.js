// js/api/openai-client.js — OpenAI 兼容 Chat Completions 视觉调用（仅传输层）
// 只做请求/响应/错误分层；提示词与结果解析分属 vision 视图与 vision-result 纯逻辑。
// API Key 绝不进入错误消息、日志或返回值。
(function (root) {
'use strict';
  const MJ = (root.MJ = root.MJ || {});

  function joinUrl(baseUrl, path) {
    const b = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!b) return '';
    if (/\/chat\/completions$/.test(b)) return b; // 已带端点则原样使用
    return b + path;
  }

  MJ.openai = {
    joinUrl,

    // 返回 { ok:true, content, usage, model, latencyMs }
    // 或   { ok:false, kind, status?, message }
    // kind: CONFIG | TIMEOUT | NETWORK(CORS) | AUTH | RATE_LIMIT | HTTP_xxx | BAD_RESPONSE
    async chatVision(opts) {
      const o = opts || {};
      if (!o.baseUrl || !o.apiKey || !o.model) {
        return { ok: false, kind: 'CONFIG', message: '缺少配置：Base URL / API Key / 模型名（请到「设置」填写）' };
      }
      const url = joinUrl(o.baseUrl, '/chat/completions');
      const timeoutMs = o.timeoutMs || 60000;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs) : null;
      const started = Date.now();

      const body = {
        model: o.model,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: o.prompt || '' },
            { type: 'image_url', image_url: { url: o.imageDataUrl } },
          ],
        }],
      };

      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + o.apiKey, // 只进请求头，不进任何返回值
          },
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined,
        });

        if (resp.status === 401 || resp.status === 403) {
          return { ok: false, kind: 'AUTH', status: resp.status, message: '认证失败(' + resp.status + ')：API Key 无效或无权限' };
        }
        if (resp.status === 429) {
          return { ok: false, kind: 'RATE_LIMIT', status: 429, message: '限流或配额不足(429)：请稍后重试或检查额度' };
        }
        if (!resp.ok) {
          let detail = '';
          try {
            const j = await resp.json();
            detail = (j && j.error && (j.error.message || j.error.code)) || '';
          } catch (e) { /* body 非 JSON，忽略 */ }
          return { ok: false, kind: 'HTTP_' + resp.status, status: resp.status, message: '接口返回 ' + resp.status + (detail ? '：' + detail : '') };
        }

        const data = await resp.json();
        const message = data && data.choices && data.choices[0] && data.choices[0].message;
        let content = message ? message.content : null;
        if (Array.isArray(content)) {
          content = content.map(function (p) { return (p && p.text) || ''; }).join('');
        }
        if (typeof content !== 'string') {
          return { ok: false, kind: 'BAD_RESPONSE', message: '响应缺少 choices[0].message.content（模型可能不支持图片输入）' };
        }
        return { ok: true, content, usage: data.usage || null, model: data.model || o.model, latencyMs: Date.now() - started };
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return { ok: false, kind: 'TIMEOUT', message: '请求超时（' + timeoutMs + 'ms）' };
        }
        // 浏览器 fetch 跨域被拦时 TypeError: Failed to fetch —— 网关必须允许 CORS
        return { ok: false, kind: 'NETWORK', message: '网络/CORS 失败：网关需允许浏览器跨域（' + ((err && err.message) || 'fetch failed') + '）' };
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = MJ.openai;
})(typeof window !== 'undefined' ? window : globalThis);
