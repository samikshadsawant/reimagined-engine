class GnaniPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.samples = new Float32Array(options.processorOptions.frameSamples)
    this.offset = 0
  }

  process(inputs, outputs) {
    const input = inputs[0]?.[0]
    const output = outputs[0]?.[0]
    if (output) output.fill(0)
    if (!input) return true

    for (let i = 0; i < input.length; i += 1) {
      this.samples[this.offset] = input[i]
      this.offset += 1
      if (this.offset === this.samples.length) {
        const frame = new Int16Array(this.samples.length)
        for (let j = 0; j < this.samples.length; j += 1) {
          const sample = Math.max(-1, Math.min(1, this.samples[j]))
          frame[j] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        }
        this.port.postMessage(frame.buffer, [frame.buffer])
        this.offset = 0
      }
    }
    return true
  }
}

registerProcessor('gnani-pcm-16k', GnaniPcmProcessor)
