import { randomBytes } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

// a build is what the agent made for one request, an example is one we made by hand.
// both open at /b/:id. the record lives in dynamodb, the agent's event log (for replay) in s3
export type Build = {
  id: string
  kind: 'build' | 'example'
  title: string
  request?: string
  model?: string
  // edited: someone changed it by hand, it has not been proven since
  status: 'building' | 'proven' | 'failed' | 'edited'
  diagram?: unknown
  sketch?: string
  test?: string
  turns?: number
  tokens?: number
  traceId?: string
  // the build this one was saved from
  forkOf?: { id: string; title: string }
  // who made it: their github id, and their login to show. examples and builds from before sign in have none
  owner?: string
  ownerLogin?: string
  createdAt: string
  updatedAt: string
}

export type Store = {
  create(b: Omit<Build, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<Build>
  update(id: string, patch: Partial<Build>): Promise<void>
  get(id: string): Promise<Build | undefined>
  list(kind: Build['kind'], limit?: number): Promise<Build[]>
  mine(owner: string, limit?: number): Promise<Build[]>
  putEvents(id: string, events: unknown[]): Promise<void>
  getEvents(id: string): Promise<unknown[]>
}

// short, url safe, no lookalike letters: k3x9q2mf
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const newId = (n = 8) => [...randomBytes(n)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

const now = () => new Date().toISOString()

export function dynamoStore({ table = 'blinkproof-builds', bucket = 'blinkproof-builds-533267199502', region = 'us-east-1' } = {}): Store {
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions: { removeUndefinedValues: true } })
  const s3 = new S3Client({ region })
  return {
    async create(b) {
      const item: Build = { ...b, id: b.id ?? newId(), createdAt: now(), updatedAt: now() }
      await db.send(new PutCommand({ TableName: table, Item: item }))
      return item
    },
    async update(id, patch) {
      const fields = Object.entries({ ...patch, updatedAt: now() }).filter(([k, v]) => k !== 'id' && v !== undefined)
      await db.send(
        new UpdateCommand({
          TableName: table,
          Key: { id },
          UpdateExpression: 'SET ' + fields.map((_, i) => `#k${i} = :v${i}`).join(', '),
          ExpressionAttributeNames: Object.fromEntries(fields.map(([k], i) => [`#k${i}`, k])),
          ExpressionAttributeValues: Object.fromEntries(fields.map(([, v], i) => [`:v${i}`, v])),
        }),
      )
    },
    async get(id) {
      const r = await db.send(new GetCommand({ TableName: table, Key: { id } }))
      return r.Item as Build | undefined
    },
    async list(kind, limit = 50) {
      const r = await db.send(
        new QueryCommand({ TableName: table, IndexName: 'by-kind', KeyConditionExpression: 'kind = :k', ExpressionAttributeValues: { ':k': kind }, ScanIndexForward: false, Limit: limit }),
      )
      return (r.Items ?? []) as Build[]
    },
    async mine(owner, limit = 50) {
      const r = await db.send(
        new QueryCommand({ TableName: table, IndexName: 'by-owner', KeyConditionExpression: '#o = :o', ExpressionAttributeNames: { '#o': 'owner' }, ExpressionAttributeValues: { ':o': owner }, ScanIndexForward: false, Limit: limit }),
      )
      return (r.Items ?? []) as Build[]
    },
    async putEvents(id, events) {
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `builds/${id}/events.json`, Body: JSON.stringify(events), ContentType: 'application/json' }))
    },
    async getEvents(id) {
      try {
        const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: `builds/${id}/events.json` }))
        return JSON.parse(await r.Body!.transformToString())
      } catch (e) {
        if ((e as { name?: string }).name === 'NoSuchKey') return []
        throw e
      }
    },
  }
}

// for tests, and for running without aws
export function memoryStore(): Store {
  const builds = new Map<string, Build>()
  const events = new Map<string, unknown[]>()
  return {
    async create(b) {
      const item: Build = { ...b, id: b.id ?? newId(), createdAt: now(), updatedAt: now() }
      builds.set(item.id, item)
      return item
    },
    async update(id, patch) {
      const b = builds.get(id)
      if (b) builds.set(id, { ...b, ...patch, updatedAt: now() })
    },
    async get(id) {
      return builds.get(id)
    },
    async list(kind, limit = 50) {
      return [...builds.values()].filter((b) => b.kind === kind).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    },
    async mine(owner, limit = 50) {
      return [...builds.values()].filter((b) => b.owner === owner).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
    },
    async putEvents(id, e) {
      events.set(id, e)
    },
    async getEvents(id) {
      return events.get(id) ?? []
    },
  }
}
