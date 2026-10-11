// cloud-result.js — 解析云函数返回值（纯函数）
// 云函数统一返回 { code, msg, data }，code === 'OK' 表示成功（见 docs/cloud-functions.md）。
// 过渡期兼容旧版云函数：房间函数直接返回数据，识牌函数返回 { ok, code, ... }。

const OK = 'OK';

function isEnvelope(result) {
  return !!result && typeof result === 'object' &&
    typeof result.code === 'string' && 'msg' in result && 'data' in result;
}

// → { ok: true, data } 或 { ok: false, code, msg }
function unwrap(result) {
  if (isEnvelope(result)) {
    return result.code === OK
      ? { ok: true, data: result.data }
      : { ok: false, code: result.code, msg: String(result.msg || '') };
  }
  // 旧版识牌函数
  if (result && typeof result === 'object' && typeof result.ok === 'boolean') {
    if (!result.ok) return { ok: false, code: result.code || 'INTERNAL_ERROR', msg: '' };
    const data = Object.assign({}, result);
    delete data.ok;
    return { ok: true, data };
  }
  // 旧版房间函数：直接返回数据
  return { ok: true, data: result === undefined ? null : result };
}

module.exports = { OK, unwrap, isEnvelope };
