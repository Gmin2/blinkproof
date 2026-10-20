import { writeFileSync } from 'node:fs'
import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import type { Early } from '../src/store.ts'

// the early access list as a csv, opens in excel or sheets. pnpm -C agent early [out.csv]
const bucket = 'blinkproof-builds-533267199502'
const s3 = new S3Client({ region: 'us-east-1' })

const rows: Early[] = []
let token: string | undefined
do {
  const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'early/', ContinuationToken: token }))
  for (const o of page.Contents ?? []) {
    const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: o.Key }))
    rows.push(JSON.parse(await r.Body!.transformToString()))
  }
  token = page.NextContinuationToken
} while (token)

const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
const csv = ['at,name,email,what', ...rows.sort((a, b) => a.at.localeCompare(b.at)).map((r) => [r.at, r.name, r.email, r.what].map(cell).join(','))].join('\n')
const out = process.argv[2] ?? 'early-access.csv'
writeFileSync(out, csv + '\n')
console.log(`${rows.length} requests -> ${out}`)
