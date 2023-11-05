"use strict";

const crypto = require("crypto");
const ed = require("ed25519");
const BlockChain = require("../blockchain");
const Consensus = require("../consensus/dpos");

let blockchains = [];
for (const i = 0; i < 20; ++i) {
  const password = `I am tester ${i}!`;
  const hash = crypto.createHash("sha256").update(password).digest();
  const keypair = ed.MakeKeypair(hash);
  console.log(`node ${i} address: ${keypair.publicKey.toString("hex")}`);

  let blockchain = new BlockChain(Consensus, keypair, i);
  blockchain.start();
  blockchains.push(blockchain);
}

setTimeout(() => {
  for (const i = 0; i < blockchains.length; ++i) {
    console.log(`${i} --> ${blockchains[i].list_peers()}`);
  }
}, 3000);

setTimeout(() => {
  blockchains[19].sync();
}, 3000);

// async function get_balance() {
//     let amount = await blockchains[0].get_balance();
//     console.log(`node 0 balance: ${amount}`);
//     amount = await blockchains[6].get_balance();
//     console.log(`node 6 balance: ${amount}`);
// }

// setInterval(get_balance, 10000);
