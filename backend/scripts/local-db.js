// Optional local development helper. This launches an actual persistent MongoDB,
// using the binary provided by mongodb-memory-server, with data kept in this project.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { MongoBinary } = require('mongodb-memory-server-core');
async function run() {
  const dbPath = path.join(__dirname, '../.local-mongodb');
  fs.mkdirSync(dbPath, { recursive: true });
  const binary = await MongoBinary.getPath();
  const child = spawn(binary, ['--dbpath', dbPath, '--bind_ip', '127.0.0.1', '--port', '27017', '--replSet', 'shopkart-rs', '--logpath', path.join(dbPath, 'mongod.log'), '--logappend'], { stdio: 'inherit', windowsHide: true });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  child.on('exit', code => { process.exitCode = code || 0; });
  // Payment confirmation updates Order and Customer together in a transaction.
  const { MongoClient } = require('mongoose').mongo;
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', { serverSelectionTimeoutMS: 1000 });
  try {
    let connected = false;
    for (let attempt = 0; attempt < 30 && !connected; attempt++) {
      if (child.exitCode !== null) throw new Error('Local MongoDB could not start. Check whether port 27017 is already in use.');
      try { await client.connect(); connected = true; } catch { await new Promise(resolve => setTimeout(resolve, 500)); }
    }
    if (!connected) throw new Error('Timed out waiting for local MongoDB');
    try { await client.db('admin').command({ replSetGetStatus: 1 }); }
    catch (e) { if (e.code !== 94) throw e; await client.db('admin').command({ replSetInitiate: { _id: 'shopkart-rs', members: [{ _id: 0, host: '127.0.0.1:27017' }] } }); }
    console.log('Persistent ShopKart replica set is configured. Data remains in ' + dbPath);
  } finally { await client.close(); }
}
run().catch(e => { console.error(e.message); process.exitCode = 1; });
