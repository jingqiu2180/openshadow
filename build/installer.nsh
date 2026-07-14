; OpenShadow NSIS installer custom steps
; Aligned with openhanako's installer.nsh (https://github.com/liliMozi/openhanako)

!macro customHeader
  RequestExecutionLevel user
!macroend

!macro customInit
  ; 升级防御（修复"卸载/升级死循环"根因）：
  ; 在 .onInit 最早阶段删除旧的卸载注册表项，使 electron-builder 的 uninstallOldVersion
  ; 读到空的 UninstallString 后提前返回，从而【跳过机器上可能残留的旧版卸载器】。
  ;
  ; 旧版(<=0.3.46)卸载器的 customUnInstall 无条件弹"是否删除用户数据"，
  ; 即使被新安装器以 /S 静默调用仍会阻塞 ExecWait -> 触发 installUtil.nsh 的
  ; UninstallLoop 重试(最多5次) -> 安装器卡死/死循环。删除注册表项后改为"覆盖安装"，
  ; 彻底断根，且对后续所有版本升级同样生效。
  ;
  ; 注：per-user 安装旧项在 HKCU；同时清 HKLM 以防曾有 per-machine 残留。
  ClearErrors
  DeleteRegKey HKEY_CURRENT_USER "${UNINSTALL_REGISTRY_KEY}"
  DeleteRegKey HKEY_LOCAL_MACHINE "${UNINSTALL_REGISTRY_KEY}"
  ClearErrors

  ; 【升级稳定性修复（0.4.4）】安装前强制杀掉正在运行的旧版 OpenShadow 进程。
  ; 旧版主进程(electron GUI) 与 server 子进程都叫 OpenShadow.exe，且常驻托盘占用
  ; 安装目录文件 → NSIS 替换文件失败 → 静默回滚成旧版（曾反复踩坑，需手动解包绕过）。
  ; 用精确文件名 OpenShadow.exe（不带通配），避免误杀安装程序自身
  ; （安装程序命名为 "OpenShadow Setup.exe" / "OpenShadow-0.4.x-Windows Setup.exe"，
  ; 精确匹配 OpenShadow.exe 不会命中带空格的安装程序进程）。
  ; openshadow-server.exe 为预留的独立 server 二进制（当前未启用），一并清理。
  nsExec::ExecToLog 'taskkill /IM OpenShadow.exe /F'
  nsExec::ExecToLog 'taskkill /IM openshadow-server.exe /F'
!macroend

!macro customInstall
  ; 创建开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\OpenShadow"
  CreateShortcut "$SMPROGRAMS\OpenShadow\OpenShadow.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" ""
  CreateShortcut "$SMPROGRAMS\OpenShadow\卸载 OpenShadow.lnk" "$INSTDIR\Uninstall ${PRODUCT_FILENAME}.exe" ""

  ; 创建桌面快捷方式
  CreateShortcut "$DESKTOP\OpenShadow.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" ""
!macroend

!macro customUnInstall
  ; 清理快捷方式
  Delete "$SMPROGRAMS\OpenShadow\OpenShadow.lnk"
  Delete "$SMPROGRAMS\OpenShadow\卸载 OpenShadow.lnk"
  RMDir "$SMPROGRAMS\OpenShadow"
  Delete "$DESKTOP\OpenShadow.lnk"

  ; 升级时本卸载器由新安装器以 /S 静默调用；IfSilent 命中即跳过弹框，避免死循环。
  ; 仅当用户手动卸载(非静默)时，才询问是否清理真实数据目录 %USERPROFILE%\.openshadow
  ; （注意：是带点的 .openshadow，配置/Key 都在这里，不在安装目录）。
  IfSilent OpenShadow_SkipDataPrompt

  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除 OpenShadow 用户数据（配置、记忆、会话，位于 %USERPROFILE%\.openshadow）？$\r$\n$\r$\n选「否」仅卸载程序，数据保留。" IDNO OpenShadow_KeepData
  RMDir /r "$PROFILE\.openshadow"
  OpenShadow_KeepData:
  OpenShadow_SkipDataPrompt:
!macroend
