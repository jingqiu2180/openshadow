// @ts-nocheck
/**
 * Text-to-Speech using system voices.
 * macOS: say command
 * Linux: espeak
 * Windows: SAPI via PowerShell
 */

import { spawn, exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export interface TtsOptions {
  text: string
  voice?: string
  output?: string
}

export interface TtsResult {
  success: true
  audioPath: string
}

export type TtsError = { success: false; error: string }
export type TtsOutput = TtsResult | TtsError

async function win32Tts(text: string, output?: string, voice?: string): Promise<TtsOutput> {
  // Windows SAPI via PowerShell
  const safeText = text
    .replace(/"/g, '`"')
    .replace(/`/g, '``')
    .replace(/\$/g, '`$')

  const psScript = `
Add-Type -AssemblyName System.Speech
$tts = New-Object System.Speech.Synthesis.SpeechSynthesizer
${voice ? `$tts.SelectVoice("${voice.replace(/"/g, '`"')}")` : ''}
$tts.SetOutputToWaveFile("${(output ?? join(tmpdir(), 'tts.wav')).replace(/\\/g, '\\\\')}")
$tts.Speak("${safeText}")
$tts.Dispose()
Write-Output "done"
`
  const psPath = join(tmpdir(), `tts-${Date.now()}.ps1`)
  writeFileSync(psPath, psScript, 'utf-8')
  try {
    return new Promise((resolve) => {
      const proc = spawn('powershell', ['-ExecutionPolicy', 'Bypass', '-File', psPath])
      proc.on('close', (code) => {
        try { unlinkSync(psPath) } catch {}
        if (code === 0) {
          resolve({ success: true, audioPath: output ?? join(tmpdir(), 'tts.wav') })
        } else {
          resolve({ success: false, error: `TTS exited with code ${code}` })
        }
      })
      proc.on('error', (e) => {
        try { unlinkSync(psPath) } catch {}
        resolve({ success: false, error: e.message })
      })
    })
  } catch (e: any) {
    try { unlinkSync(psPath) } catch {}
    return { success: false, error: e.message }
  }
}

export async function textToSpeech(options: TtsOptions): Promise<TtsOutput> {
  const { text, voice, output } = options
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      const args = ['-v', voice ?? 'Ting-Ting', '-o', output ?? '/tmp/tts.aiff']
      return new Promise((resolve) => {
        const proc = spawn('say', args)
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, audioPath: output ?? '/tmp/tts.aiff' })
          } else {
            resolve({ success: false, error: `say exited with ${code}` })
          }
        })
      })
    } else if (platform === 'linux') {
      const args = ['-w', output ?? '/tmp/tts.wav', '-ven', voice ?? 'en+f3', text]
      return new Promise((resolve) => {
        const proc = spawn('espeak', args)
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, audioPath: output ?? '/tmp/tts.wav' })
          } else {
            resolve({ success: false, error: `espeak not installed or failed (code ${code})` })
          }
        })
        proc.on('error', () => {
          resolve({ success: false, error: 'espeak not installed. Run: sudo apt install espeak' })
        })
      })
    } else if (platform === 'win32') {
      return win32Tts(text, output, voice)
    }

    return {
      success: false,
      error: `TTS not supported on ${platform}. Install espeak (Linux), say (macOS), or use a cloud TTS API.`,
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function listVoices(): Promise<string[]> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      const { stdout } = await execAsync('say -v ?')
      return stdout.split('\n').map(line => line.trim().split(' ')[0]).filter(Boolean)
    } else if (platform === 'win32') {
      const ps = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }`
      const { stdout } = await execAsync(`powershell -Command "${ps}"`)
      return stdout.split('\n').map(s => s.trim()).filter(Boolean)
    } else if (platform === 'linux') {
      return ['en', 'en-us', 'en-sc', 'fr', 'de', 'es', 'it', 'ru', 'zh']
    }
    return ['default']
  } catch {
    return ['default']
  }
}

export function createTtsTools() {
  return {
    tts: textToSpeech,
    tts_voices: listVoices,
  }
}