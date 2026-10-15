#!/usr/bin/env node
// Points your Twilio number's "A call comes in" webhook at this server, so you can
// call your agent. It saves the previous setting first and can put it back.
//
//   npm run twilio:connect              show the current setting (changes nothing)
//   npm run twilio:connect -- --apply   point the number at this server (saves a backup)
//   npm run twilio:connect -- --restore put the saved previous setting back
import fs from 'node:fs';
import path from 'node:path';
import { client, ourNumber, publicUrl } from '../src/twilio.js';

const BACKUP = path.resolve('data', 'twilio-webhook-backup.json');
const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--restore') ? 'restore' : 'show';

const number = await ourNumber();
const [record] = await client.incomingPhoneNumbers.list({ phoneNumber: number, limit: 1 });
if (!record) throw new Error(`Number ${number} not found in this Twilio account.`);

const current = {
  phoneNumber: record.phoneNumber,
  voiceUrl: record.voiceUrl,
  voiceMethod: record.voiceMethod,
  voiceApplicationSid: record.voiceApplicationSid || '',
  savedAt: new Date().toISOString(),
};
console.log(`Number:          ${record.phoneNumber}`);
console.log(`Current webhook: ${record.voiceUrl || '(none)'} [${record.voiceMethod}]${record.voiceApplicationSid ? ` | TwiML App ${record.voiceApplicationSid}` : ''}`);

if (mode === 'show') {
  console.log('\nNothing changed. Use --apply to point it at this server, --restore to undo.');
} else if (mode === 'apply') {
  const target = `${await publicUrl()}/twilio/voice`;
  if (record.voiceUrl === target) {
    console.log('Already pointing at this server.');
  } else {
    fs.mkdirSync(path.dirname(BACKUP), { recursive: true });
    if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, JSON.stringify(current, null, 2));
    await client.incomingPhoneNumbers(record.sid).update({ voiceUrl: target, voiceMethod: 'POST', voiceApplicationSid: '' });
    console.log(`New webhook:     ${target} [POST]`);
    console.log(`Backup of the previous setting: ${path.relative(process.cwd(), BACKUP)}`);
  }
} else {
  if (!fs.existsSync(BACKUP)) throw new Error('No backup found, nothing to restore.');
  const saved = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  await client.incomingPhoneNumbers(record.sid).update({
    voiceUrl: saved.voiceUrl || '', voiceMethod: saved.voiceMethod || 'POST', voiceApplicationSid: saved.voiceApplicationSid || '',
  });
  fs.unlinkSync(BACKUP);
  console.log(`Restored webhook: ${saved.voiceUrl || '(none)'}`);
}
