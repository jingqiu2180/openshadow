import { useStore } from '../../stores';
import { InputArea, type InputAreaProps } from '../InputArea';
import { WelcomeScreen } from '../WelcomeScreen';
import { ChatArea } from '../chat/ChatArea';
import { RegionalErrorBoundary } from '../RegionalErrorBoundary';

function WelcomeContainer() {
  const visible = useStore(s => s.welcomeVisible);
  return (
    <div className={`welcome${visible ? '' : ' hidden'}`} id="welcome">
      <WelcomeScreen />
    </div>
  );
}

export function ChatPage({
  inputSurface = 'desktop',
  regionPrefix = '',
}: {
  inputSurface?: NonNullable<InputAreaProps['surface']>;
  regionPrefix?: string;
} = {}) {
  const welcomeVisible = useStore(s => s.welcomeVisible);
  const currentSessionPath = useStore(s => s.currentSessionPath);
  const hasPanels = !welcomeVisible && !!currentSessionPath;

  // remu 修复：新对话窗口首次发送时 ensureSession() 会把 currentSessionPath 从 null 变为实际路径，
  // 如果用 currentSessionPath 做 key，InputArea 会被销毁重建，导致正在执行的 send 闭包里的 editor 失效。
  // 用 '__remu-input' 作为稳定 key（只对 surface 变化时重建，比如 desktop ↔ mobile）。
  return (
    <>
      <div className={`chat-area${hasPanels ? ' has-panels' : ''}`}>
        <WelcomeContainer />
        <RegionalErrorBoundary region={`${regionPrefix}chat`} resetKeys={[currentSessionPath]}>
          <ChatArea />
        </RegionalErrorBoundary>
      </div>
      <div className="input-area">
        <RegionalErrorBoundary
          region={`${regionPrefix}input`}
          resetKeys={[currentSessionPath]}
          autoRetry={inputSurface === 'mobile' ? { attempts: 2, delayMs: 120 } : undefined}
        >
          <InputArea key={`remu-input-${inputSurface}`} surface={inputSurface} />
        </RegionalErrorBoundary>
      </div>
    </>
  );
}
