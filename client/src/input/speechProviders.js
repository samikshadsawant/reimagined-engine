const CONNECTION_TIMEOUT_MS = 15000

export class SpeechProvider {
  async start() {
    throw new Error('SpeechProvider.start must be implemented.')
  }

  stop() {}
}

export class BrowserSpeechProvider extends SpeechProvider {
  constructor({ language, onTranscript, onStatus, onError }) {
    super()
    this.language = language
    this.onTranscript = onTranscript
    this.onStatus = onStatus
    this.onError = onError
    this.stopped = false
    this.restartTimer = null
    this.recognition = null
  }

  async start() {
    const Recognition = window.webkitSpeechRecognition || window.SpeechRecognition
    if (!Recognition) throw new Error('Browser speech recognition is not supported.')

    this.stopped = false
    const recognition = new Recognition()
    this.recognition = recognition
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1
    recognition.lang = this.language

    recognition.onstart = () => this.onStatus('listening')
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0]?.transcript?.trim()
        if (text) this.onTranscript(text, result.isFinal)
      }
    }
    recognition.onerror = (event) => {
      if (this.stopped) return
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        this.onError(new Error('Microphone access was denied or unavailable.'))
      } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
        this.onError(new Error(`Browser speech recognition failed: ${event.error}`))
      }
    }
    recognition.onend = () => {
      if (this.stopped) return
      this.onStatus('connecting')
      this.restartTimer = setTimeout(() => {
        if (!this.stopped) {
          try {
            recognition.start()
          } catch (error) {
            this.onError(error)
          }
        }
      }, 300)
    }
    recognition.start()
  }

  stop() {
    this.stopped = true
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    if (this.recognition) {
      this.recognition.onend = null
      try {
        this.recognition.stop()
      } catch (error) {
        if (error.name !== 'InvalidStateError') this.onError(error)
      }
      this.recognition = null
    }
  }
}

export class GnaniPrismaSpeechProvider extends SpeechProvider {
  constructor({ language, sampleRate, frameSamples, onTranscript, onStatus, onError, onAudioLevel }) {
    super()
    this.language = language
    this.sampleRate = sampleRate
    this.frameSamples = frameSamples
    this.frameBytes = frameSamples * 2
    this.onTranscript = onTranscript
    this.onStatus = onStatus
    this.onError = onError
    this.onAudioLevel = onAudioLevel
    this.socket = null
    this.stream = null
    this.audioContext = null
    this.source = null
    this.worklet = null
    this.gain = null
    this.stopped = false
    this.connected = false
  }

  async start() {
    if (!window.AudioWorkletNode || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser cannot stream microphone audio to Gnani.')
    }
    this.stopped = false
    this.onStatus('connecting')
    const socketUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/gnani/stt`
    const socket = new WebSocket(socketUrl)
    this.socket = socket
    socket.binaryType = 'arraybuffer'

    await new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        finish(new Error('Timed out connecting to Gnani Prisma.'))
      }, CONNECTION_TIMEOUT_MS)
      const finish = (error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        if (error) reject(error)
        else resolve()
      }

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'start', language: this.language }))
      }
      socket.onmessage = async (event) => {
        let message
        try {
          message = JSON.parse(event.data)
        } catch {
          const error = new Error('Received an invalid response from the speech service.')
          if (settled) this.onError(error)
          else finish(error)
          return
        }
        if (message.type === 'error') {
          const error = new Error(message.message || 'Gnani Prisma could not start.')
          if (settled) this.onError(error)
          else finish(error)
          return
        }
        if (message.type === 'connected' && !this.connected) {
          try {
            await this.startCapture()
            if (this.stopped) {
              finish(new Error('Gnani Prisma speech capture was stopped.'))
              return
            }
            this.connected = true
            this.onStatus('listening')
            finish()
          } catch (error) {
            finish(error)
          }
        } else if (message.type === 'processing') {
          this.onStatus('processing')
        } else if (message.type === 'transcript' && typeof message.text === 'string') {
          this.onStatus('listening')
          this.onTranscript(message.text, true)
        }
      }
      socket.onerror = () => {
        const error = new Error('Network connection to Gnani Prisma failed.')
        if (settled) this.onError(error)
        else finish(error)
      }
      socket.onclose = (event) => {
        if (!this.stopped && event.code !== 1000) {
          const error = new Error('The Gnani Prisma connection closed unexpectedly.')
          if (settled) this.onError(error)
          else finish(error)
        }
      }
    })
  }

  async startCapture() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
    try {
      if (this.stopped) throw new Error('Gnani Prisma speech capture was stopped.')
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate })
      if (this.audioContext.sampleRate !== this.sampleRate) {
        throw new Error(`This browser cannot capture microphone audio at ${this.sampleRate} Hz.`)
      }
      await this.audioContext.audioWorklet.addModule('/gnani-pcm-worklet.js')
      if (this.stopped) throw new Error('Gnani Prisma speech capture was stopped.')
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.worklet = new AudioWorkletNode(this.audioContext, 'gnani-pcm-16k', {
        processorOptions: { frameSamples: this.frameSamples },
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1]
      })
      this.gain = this.audioContext.createGain()
      this.gain.gain.value = 0
      this.worklet.port.onmessage = ({ data }) => {
        if (this.stopped || this.socket?.readyState !== WebSocket.OPEN) return
        if (!(data instanceof ArrayBuffer) || data.byteLength !== this.frameBytes) {
          this.onError(new Error('The microphone produced an invalid audio frame.'))
          return
        }
        const samples = new Int16Array(data)
        let total = 0
        for (const sample of samples) total += Math.abs(sample)
        this.onAudioLevel?.(Math.min(100, Math.round(total / samples.length / 327.67)))
        if (this.socket.bufferedAmount > this.frameBytes * 32) {
          this.onError(new Error('The speech connection is too slow to keep up with microphone audio.'))
          return
        }
        this.socket.send(data)
      }
      this.source.connect(this.worklet)
      this.worklet.connect(this.gain)
      this.gain.connect(this.audioContext.destination)
      await this.audioContext.resume()
    } catch (error) {
      this.stopCapture()
      throw error
    }
  }

  stopCapture() {
    if (this.worklet) {
      this.worklet.port.onmessage = null
      this.worklet.disconnect()
      this.worklet = null
    }
    if (this.source) {
      this.source.disconnect()
      this.source = null
    }
    if (this.gain) {
      this.gain.disconnect()
      this.gain = null
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    if (this.audioContext) {
      void this.audioContext.close()
      this.audioContext = null
    }
  }

  stop() {
    this.stopped = true
    this.stopCapture()
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      if (this.socket.readyState < WebSocket.CLOSING) this.socket.close(1000, 'Voice stopped')
      this.socket = null
    }
  }
}

export function browserRecognitionLanguage(language) {
  if (language === 'hindi') return 'hi-IN'
  if (language === 'marathi') return 'mr-IN'
  return 'en-IN'
}
