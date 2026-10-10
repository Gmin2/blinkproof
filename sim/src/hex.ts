// intel hex to the 32k flash of a 328p
export function loadHex(text: string, flashBytes = 0x8000) {
  const bytes = new Uint8Array(flashBytes)
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line[0] !== ':' || line.slice(7, 9) !== '00') continue
    const n = parseInt(line.slice(1, 3), 16)
    const addr = parseInt(line.slice(3, 7), 16)
    for (let i = 0; i < n; i++) bytes[addr + i] = parseInt(line.slice(9 + i * 2, 11 + i * 2), 16)
  }
  return new Uint16Array(bytes.buffer)
}
