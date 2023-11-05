"use strict";

const crypto = require("crypto");
const ed = require("ed25519");
const BlockChain = require("../blockchain");
const Consensus = require("../consensus/dpos");

const password = "I am tester!";

const hash = crypto.createHash("sha256").update(password).digest();
const keypair = ed.MakeKeypair(hash);

let blockchains = [];
for (const i = 0; i < 20; ++i) {
  let blockchain = new BlockChain(Consensus, keypair, i);
  blockchain.start();
  blockchains.push(blockchain);
}

// setTimeout(() => {
//     for (const i = 0; i < 20; ++i) {
//         console.log(`${i} --> ${blockchains[i].list_peers()}`);
//     }
// }, 3000);

setTimeout(async () => {
  console.log("=================");
  await blockchains[0].iterator_forward((block) => {
    console.log("-----------------");
    console.log(block.height);
    console.log(block.hash);
    return true;
  }, blockchains[0].get_last_block().hash);
}, 5000);
