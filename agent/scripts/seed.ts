import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

// the hand built examples go into the store as kind example, each under its own slug, /b/parking and so on.
// pnpm -C agent seed
const EXAMPLES: [id: string, title: string, dir: string, sketch?: string][] = [
  ['blink', 'Blink', 'blink'],
  ['hello-oled', 'Hello oled', 'hello-oled'],
  ['parts-tour', 'Parts tour', 'parts-tour'],
  ['parking', 'Parking sensor', 'parking'],
  ['parking-ram', 'Parking sensor, out of ram', 'parking', 'parking-ram/parking-ram.ino'],
  ['pot-print', 'Pot reader', 'pot-print'],
  ['nano-dimmer', 'Nano dimmer', 'nano-dimmer'],
  ['pico-plant', 'Pico plant monitor', 'pico-plant'],
]

const root = resolve(import.meta.dirname, '../../sketches')
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }))
const base = Date.parse('2026-10-11T00:00:00Z')

for (const [i, [id, title, dir, sketch]] of EXAMPLES.entries()) {
  const read = (f: string) => readFileSync(join(root, f), 'utf8')
  const test = existsSync(join(root, dir, 'test.yaml')) ? read(join(dir, 'test.yaml')) : undefined
  // newest first is how the store lists, so the first example gets the latest stamp
  const at = new Date(base - i * 1000).toISOString()
  await db.send(
    new PutCommand({
      TableName: 'blinkproof-builds',
      Item: { id, kind: 'example', title, status: test ? 'proven' : 'edited', diagram: JSON.parse(read(join(dir, 'diagram.json'))), sketch: read(sketch ?? join(dir, `${dir}.ino`)), ...(test && { test }), createdAt: at, updatedAt: at },
    }),
  )
  console.log(`seeded ${id}`)
}
