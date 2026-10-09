import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const source = readFileSync(new URL('../src/lib/recipients.ts', import.meta.url), 'utf8').replace(/^import .*\n/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { recipientToken, insertRecipient, rankRecipients } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
assert.deepEqual(recipientToken('a@example.com; Th; b@example.com', 16), { start: 14, end: 17, query: 'Th' })
assert.equal(insertRecipient('a@example.com; Th; b@example.com', 16, 'thomas@example.com').value, 'a@example.com; thomas@example.com; b@example.com')
assert.equal(insertRecipient('Tho', 3, 'thomas@example.com').value, 'thomas@example.com, ')
assert.deepEqual(rankRecipients([
  { from: { emailAddress: { name: 'Renée', address: 'RENEE@example.com' } } },
  { toRecipients: [{ emailAddress: { address: 'renee@example.com' } }, { emailAddress: { name: 'Other', address: 'other@example.com' } }] },
  { from: { emailAddress: { name: 'Renée Bad', address: '/o=Exchange/cn=renee' } } },
], 'renee'), [{ name: 'Renée', address: 'renee@example.com' }])
console.log('Recipient matching, normalization, deduplication and caret replacement passed.')
