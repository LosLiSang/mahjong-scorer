'use strict';

// 云函数统一返回结构：{ code, msg, data }
//   成功：{ code: 'OK', msg: '', data }
//   失败：{ code: '<错误码>', msg: '<给用户看的提示>', data: null }
// 云函数一律通过返回值报错，不向调用方抛异常。
//
// 真源在 packages/cloud-response/index.js，由 scripts/sync-shared.js 复制到各云函数目录的 response.js
//（云函数上传时只能包含自身目录内的文件）。不要直接改副本。

const OK = 'OK';
const INTERNAL_ERROR = 'INTERNAL_ERROR';
const DEFAULT_MESSAGE = '服务暂时不可用，请稍后重试';

// 业务代码里抛出带错误码的异常，由 handle 统一转成返回值
class CodedError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function fail(code) {
  throw new CodedError(code);
}

function success(data) {
  return { code: OK, msg: '', data: data === undefined ? null : data };
}

function failure(code, messages) {
  const table = messages || {};
  return { code, msg: table[code] || table[INTERNAL_ERROR] || DEFAULT_MESSAGE, data: null };
}

// 从异常中取已登记的错误码：
//   1. CodedError.code，或领域层 new Error('CODE') 的 message
//   2. 被包装过的消息（如事务抛出的 "... VERSION_CONFLICT ..."）中包含的错误码，按长度优先匹配
// 都取不到时返回 INTERNAL_ERROR
function errorCode(err, messages) {
  const codes = Object.keys(messages || {}).filter(code => code !== INTERNAL_ERROR);
  const exact = [err && err.code, err && err.message].find(value => typeof value === 'string' && codes.includes(value));
  if (exact) return exact;
  const text = [err && err.code, err && err.message, err && err.errMsg].filter(value => typeof value === 'string').join(' ');
  return codes.sort((a, b) => b.length - a.length).find(code => new RegExp(`\\b${code}\\b`).test(text)) || INTERNAL_ERROR;
}

// 执行业务函数并包装成统一结构；未登记的异常记日志，对外只返回 INTERNAL_ERROR，不泄露内部信息
async function handle(run, messages) {
  try {
    return success(await run());
  } catch (err) {
    const code = errorCode(err, messages);
    if (code === INTERNAL_ERROR) console.error('unexpected error', err);
    return failure(code, messages);
  }
}

module.exports = { OK, INTERNAL_ERROR, CodedError, fail, success, failure, errorCode, handle };
