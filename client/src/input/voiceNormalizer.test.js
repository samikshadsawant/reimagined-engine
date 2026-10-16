import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVoiceCommand } from './voiceNormalizer.js'

test('normalizes romanized Hinglish app commands', () => {
  assert.equal(normalizeVoiceCommand('calculator kholo'), 'open calculator')
  assert.equal(normalizeVoiceCommand('notepad khol do'), 'open notepad')
})

test('normalizes Devanagari app commands', () => {
  assert.equal(normalizeVoiceCommand('कृपया कैलकुलेटर खोलो'), 'open calculator')
  assert.equal(normalizeVoiceCommand('कृपया नोटपैड खोल दो'), 'open notepad')
})

test('normalizes app close and generic close commands', () => {
  assert.equal(normalizeVoiceCommand('calculator band karo'), 'close calculator')
  assert.equal(normalizeVoiceCommand('बंद करो'), 'close window')
})

test('normalizes reminder and volume phrases for existing fallback handling', () => {
  assert.equal(normalizeVoiceCommand('yaad dilao mujhe medicine at 9'), 'remind me to medicine at 9')
  assert.equal(normalizeVoiceCommand('volume badhao'), 'increase volume')
})

test('removes common fillers without changing regular English commands', () => {
  assert.equal(normalizeVoiceCommand('please ज़रा open calculator'), 'open calculator')
  assert.equal(normalizeVoiceCommand('open settings'), 'open settings')
  assert.equal(normalizeVoiceCommand(null), '')
})
