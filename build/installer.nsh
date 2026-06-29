; OpenShadow NSIS installer custom steps
; Aligned with openhanako's installer.nsh (https://github.com/liliMozi/openhanako)

!macro customHeader
  RequestExecutionLevel user
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

  ; 清理用户数据（提示用户）
  MessageBox MB_YESNO|MB_ICONQUESTION "是否同时删除 OpenShadow 用户数据（配置、记忆、会话）？$\r$\n$\r$\n选否仅卸载程序，数据保留在 %APPDATA%\OpenShadow。" IDNO skip_data_cleanup
  RMDir /r "$APPDATA\OpenShadow"
  RMDir /r "$LOCALAPPDATA\OpenShadow"
  skip_data_cleanup:
!macroend