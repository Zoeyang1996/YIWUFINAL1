// Recover an oversized first Sites push by sending an equivalent tree in small commits.
// Run from the generated Site checkout. Credentials are accepted only through hidden stdin.
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

console.log('Ready for Site credential JSON on stdin (input is hidden).');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
const credential = await new Promise((resolve, reject) => {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', function onData(chunk) {
    input += chunk;
    if (!/[\r\n]/.test(input)) return;
    process.stdin.removeListener('data', onData);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    try { resolve(JSON.parse(input.trim())); } catch { reject(new Error('Invalid input')); }
  });
});
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const auth = ['-c', 'credential.helper=', '-c', 'http.extraHeader=', '-c', 'http.followRedirects=false'];
if (credential.auth_mode === 'http_extra_header') {
  env.SITES_GIT_AUTHORIZATION = `Authorization: Bearer ${credential.token}`;
  auth.push(`--config-env=http.${credential.remote_url}.extraHeader=SITES_GIT_AUTHORIZATION`);
}
async function git(args, { network = false, input, index } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', [...(network ? auth : []), ...args], {
      env: { ...env, ...(index ? { GIT_INDEX_FILE: index } : {}) }, windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '', err = '';
    child.stdout.on('data', c => out += c);
    child.stderr.on('data', c => err += c);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trimEnd()) : reject(new Error(err.split(credential.token || '\0').join('[redacted]'))));
    child.stdin.end(input);
  });
}
try {
  const ref = `refs/heads/${credential.branch}`;
  const original = await git(['rev-parse', 'HEAD']);
  const expectedTree = await git(['rev-parse', 'HEAD^{tree}']);
  const remote = await git(['ls-remote', '--heads', credential.remote_url, ref], { network: true });
  if (remote.trim()) {
    const remoteHead = remote.split(/\s+/)[0];
    await git(['merge-base', '--is-ancestor', remoteHead, original]);
    const remaining = (await git(['rev-list', '--reverse', `${remoteHead}..${original}`])).split('\n').filter(Boolean);
    for (const [i, commit] of remaining.entries()) {
      console.log(`Uploading remaining batch ${i + 1}/${remaining.length}…`);
      await git(['push', credential.remote_url, `${commit}:${ref}`], { network: true });
      console.log(`Remaining batch ${i + 1} uploaded.`);
    }
    const pushed = (await git(['ls-remote', '--heads', credential.remote_url, ref], { network: true })).split(/\s+/)[0];
    if (pushed !== original) throw new Error('Remote HEAD mismatch');
    console.log(JSON.stringify({ commit_sha: original, verified: true }));
    process.exit(0);
  }
  const records = (await git(['ls-tree', '-rz', '--full-tree', 'HEAD'])).split('\0').filter(Boolean).map(row => {
    const split = row.indexOf('\t');
    return { info: row.slice(0, split), name: row.slice(split + 1) };
  });
  records.sort((a, b) => a.name.localeCompare(b.name));
  const index = path.resolve('.git/publication-batch-index');
  await git(['read-tree', '--empty'], { index });
  const groups = [];
  let current = [], bytes = 0;
  for (const record of records) {
    const size = (await fs.stat(record.name)).size;
    if (bytes + size > 48 * 1024 * 1024 && current.length) { groups.push(current); current = []; bytes = 0; }
    current.push(record); bytes += size;
  }
  if (current.length) groups.push(current);
  const commits = [];
  let parent;
  for (const [i, group] of groups.entries()) {
    await git(['update-index', '-z', '--index-info'], { index, input: group.map(r => `${r.info}\t${r.name}\0`).join('') });
    const tree = await git(['write-tree'], { index });
    parent = await git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Upload Site assets ${i + 1}/${groups.length}`]);
    commits.push(parent);
  }
  if (await git(['rev-parse', `${parent}^{tree}`]) !== expectedTree) throw new Error('Final tree mismatch');
  await git(['update-ref', 'refs/heads/pre-batched-publication', original]);
  await git(['update-ref', ref, parent, original]);
  await fs.unlink(index);
  for (const [i, commit] of commits.entries()) {
    console.log(`Uploading batch ${i + 1}/${commits.length}…`);
    await git(['push', credential.remote_url, `${commit}:${ref}`], { network: true });
    console.log(`Batch ${i + 1} uploaded.`);
  }
  const pushed = (await git(['ls-remote', '--heads', credential.remote_url, ref], { network: true })).split(/\s+/)[0];
  if (pushed !== parent) throw new Error('Remote HEAD mismatch');
  console.log(JSON.stringify({ commit_sha: parent, batches: commits.length, verified: true }));
} catch (error) { console.error(error.message); process.exitCode = 1; }
