// @ts-nocheck
import { describe, it, expect } from 'vitest'
import { PIIProtector } from '../../core/sandbox/pii-protector.js'

describe('PIIProtector', () => {
  it('should redact phone numbers', () => {
    const pii = new PIIProtector()
    const result = pii.redact('Call me at 13812345678')
    expect(result).not.toContain('13812345678')
    expect(result).toContain('****')
  })

  it('should redact email addresses', () => {
    const pii = new PIIProtector()
    const result = pii.redact('Email: test@example.com')
    expect(result).not.toContain('test@example.com')
    expect(result).toContain('te***@example.com')
  })

  it('should redact bank card numbers', () => {
    const pii = new PIIProtector()
    const result = pii.redact('Card: 6222021234567890')
    expect(result).not.toContain('6222021234567890')
    expect(result).toContain('6222****7890')
  })

  it('should redact Chinese ID card numbers', () => {
    const pii = new PIIProtector()
    const result = pii.redact('ID: 110101199001011234')
    expect(result).not.toContain('110101199001011234')
    expect(result).toContain('****')
  })

  it('should redact API keys', () => {
    const pii = new PIIProtector()
    const result = pii.redact('api_key: sk-abc123def456')
    expect(result).not.toContain('sk-abc123def456')
    expect(result).toContain('***REDACTED***')
  })

  it('should redact IP addresses', () => {
    const pii = new PIIProtector()
    const result = pii.redact('Server: 192.168.1.100')
    expect(result).not.toContain('192.168.1.100')
    expect(result).toContain('x.x.x.x')
  })

  it('should detect PII in text', () => {
    const pii = new PIIProtector()
    const detections = pii.detect('Phone: 13812345678, Email: test@example.com')
    expect(detections.length).toBeGreaterThanOrEqual(2)
    expect(detections.some(d => d.label === 'phone_cn')).toBe(true)
    expect(detections.some(d => d.label === 'email')).toBe(true)
  })

  it('should report hasPII correctly', () => {
    const pii = new PIIProtector()
    expect(pii.hasPII('Hello world')).toBe(false)
    expect(pii.hasPII('My phone is 13812345678')).toBe(true)
  })

  it('should redact messages array', () => {
    const pii = new PIIProtector()
    const messages = [
      { role: 'user', content: 'My email is test@example.com' },
      { role: 'assistant', content: 'Got it!' },
    ]
    const result = pii.redactMessages(messages)
    expect(result[0].content).not.toContain('test@example.com')
    expect(result[1].content).toBe('Got it!')
  })

  it('should support custom rules', () => {
    const pii = new PIIProtector({
      rules: [{ pattern: /secret-\d+/g, label: 'custom', replacement: () => '***' }],
    })
    expect(pii.redact('Code: secret-12345')).toBe('Code: ***')
  })

  it('should support enableOnly filter', () => {
    const pii = new PIIProtector({ enableOnly: ['phone_cn'] })
    const result = pii.redact('Phone: 13812345678, Email: test@example.com')
    expect(result).not.toContain('13812345678')
    expect(result).toContain('test@example.com')
  })

  it('should not modify text without PII', () => {
    const pii = new PIIProtector()
    const text = 'The weather is nice today.'
    expect(pii.redact(text)).toBe(text)
  })
})
