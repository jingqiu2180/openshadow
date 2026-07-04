/**
 * DeepResearchLauncher — 深度研究启动器
 *
 * 提供深度研究功能的快速入口，填入模板并启动。
 */

import { DeepResearchPanel } from './DeepResearchPanel';

export interface DeepResearchLauncherProps {
  visible: boolean;
  busy: boolean;
  isStreaming: boolean;
  onStart: () => void | Promise<void>;
  onClose: () => void;
  setInputValue?: (text: string) => void;
  readLatestInputValue?: () => string;
  requestInputFocus?: () => void;
  recoveryMessage?: string | null;
}

export function DeepResearchLauncher({
  visible,
  busy,
  isStreaming,
  onStart,
  onClose,
  setInputValue,
  readLatestInputValue,
  requestInputFocus,
  recoveryMessage,
}: DeepResearchLauncherProps) {
  if (!visible || recoveryMessage) return null;

  const handleFillTemplate = () => {
    const template = '为我做一份深度调研：';
    if (readLatestInputValue && readLatestInputValue().trim()) {
      requestInputFocus?.();
      return;
    }
    setInputValue?.(template);
    requestInputFocus?.();
  };

  return (
    <DeepResearchPanel
      visible={visible}
      busy={busy}
      isStreaming={isStreaming}
      onClose={onClose}
      onFillTemplate={handleFillTemplate}
      onStart={onStart}
    />
  );
}
