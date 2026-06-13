import { spawn } from 'child_process'

export interface TtsOptions {
  text: string
  voice?: string
  speed?: number
  output?: string
}

export interface TtsResult {
  success: true
  audioPath: string
}

export type TtsError = { success: false; error: string }
export type TtsOutput = TtsResult | TtsError

/**
 * Text-to-Speech using system voices.
 * macOS: say command
 * Linux: espeak / festival
 * Windows: SAPI (not implemented)
 */
export async function textToSpeech(options: TtsOptions): Promise<TtsOutput> {
  const { text, voice, speed, output } = options
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      // macOS: say command
      const args = ['-v', voice ?? 'Ting-Ting', '-o', output ?? '/tmp/tts.aiff', text]
      if (speed) args.unshift('-r', String(speed))

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
      // Linux: espeak
      const args = ['-w', output ?? '/tmp/tts.wav', '-ven', voice ?? 'en', text]
      return new Promise((resolve) => {
        const proc = spawn('espeak', args)
        proc.on('close', (code) => {
          if (code === 0) {
            resolve({ success: true, audioPath: output ?? '/tmp/tts.wav' })
          } else {
            resolve({ success: false, error: `espeak exited with ${code}` })
          }
        })
      })
    }

    return { success: false, error: 'Platform not supported' }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * List available voices.
 */
export async function listVoices(): Promise<string[]> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)
      const { stdout } = await execAsync('say -v ?')
      return stdout.split('\n').map(line => line.trim()).filter(Boolean)
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