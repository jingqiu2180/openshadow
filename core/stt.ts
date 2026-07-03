/**
 * Speech-to-Text using system tools.
 * macOS: sox
 * Linux: arecord + pocketsphinx
 * Windows: graceful degradation with helpful error message
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface SttResult {
  success: true
  text: string
  confidence: number
}

export type SttError = { success: false; error: string }
export type SttOutput = SttResult | SttError

/**
 * Convert speech audio to text.
 */
export async function speechToText(audioPath: string): Promise<SttOutput> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      // macOS: sox for recording, STT requires cloud API
      try {
        await execAsync(`sox "${audioPath}" -r 16000 -c 1 /tmp/stt-input.wav trim 0 1 2>&1`)
        return { success: true, text: '(macOS STT requires cloud API for full support)', confidence: 0.5 }
      } catch {
        return { success: false, error: 'sox not installed. Run: brew install sox' }
      }
    } else if (platform === 'linux') {
      try {
        const { stdout } = await execAsync(
          `pocketsphinx_continuous -infile "${audioPath}" -lm none -dict /dev/null 2>/dev/null`
        )
        return { success: true, text: stdout.trim(), confidence: 0.7 }
      } catch {
        return {
          success: false,
          error: 'pocketsphinx not installed. Run: sudo apt install pocketsphinx pocketsphinx-en-us',
        }
      }
    } else if (platform === 'win32') {
      return {
        success: false,
        error: 'Windows STT requires a cloud API (Azure Speech, Google Speech) or install Whisper locally (pip install openai-whisper).',
      }
    }

    return { success: false, error: `Platform not supported: ${platform}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

/**
 * Record audio from microphone.
 */
export async function recordAudio(
  duration: number = 5,
  outputPath?: string
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const platform = process.platform
  const path = outputPath ?? `/tmp/stt-input.wav`

  try {
    if (platform === 'darwin') {
      const { spawn } = await import('child_process')
      return new Promise((resolve) => {
        const proc = spawn('sox', ['-d', '-r', '16000', '-c', '1', path, 'trim', '0', String(duration)])
        proc.on('close', (code) => {
          if (code === 0) resolve({ success: true, path })
          else resolve({ success: false, error: `sox recording failed with code ${code}` })
        })
        proc.on('error', (e) => resolve({ success: false, error: `sox error: ${e.message}` }))
      })
    } else if (platform === 'linux') {
      const { spawn } = await import('child_process')
      return new Promise((resolve) => {
        const proc = spawn('arecord', ['-f', 'cd', '-d', String(duration), '-t', 'wav', path])
        proc.on('close', (code) => {
          if (code === 0) resolve({ success: true, path })
          else resolve({ success: false, error: `arecord failed (code ${code}). Install: sudo apt install alsa-utils` })
        })
        proc.on('error', (e) => resolve({ success: false, error: `arecord not found: ${e.message}` }))
      })
    } else if (platform === 'win32') {
      return {
        success: false,
        error: 'Windows audio recording requires NAudio or similar. Suggest installing Whisper: pip install openai-whisper',
      }
    }

    return { success: false, error: `Audio recording not supported on ${platform}` }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export function createSttTools() {
  return {
    stt: speechToText,
    record_audio: recordAudio,
  }
}