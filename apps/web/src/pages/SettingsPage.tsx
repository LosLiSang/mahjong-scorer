import { useState } from 'react';

const CONTACT = 'lisangcode@outlook.com';

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  async function copyContact() {
    try {
      await navigator.clipboard.writeText(CONTACT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('复制联系邮箱', CONTACT);
    }
  }

  function clearLocalData() {
    if (!window.confirm('确定清除本机保存的对局数据？此操作不可恢复。')) return;
    Object.keys(localStorage)
      .filter((key) => key.startsWith('mj_'))
      .forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  }

  return (
    <div>
      <div className="placeholder-card">
        <div className="icon">⚙️</div>
        <h2>设置</h2>
        <ul>
          <li style={{ cursor: 'pointer' }} onClick={copyContact}>
            联系与合作：{CONTACT}{copied ? '（已复制）' : ''}
          </li>
          <li style={{ cursor: 'pointer' }} onClick={clearLocalData}>清除本机对局数据</li>
        </ul>
        <p style={{ marginTop: 12 }}>
          房间服务（联机对战）将在 TS 后端就绪后在这里配置；
          玩家资料与默认规则也会随房间功能一并迁移。
        </p>
      </div>
    </div>
  );
}
