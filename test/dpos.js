"use strict";

const crypto = require("crypto");
const ed = require("ed25519");
const BlockChain = require("../blockchain");
const Consensus = require("../consensus/dpos");
const Promise = require("bluebird");

const password = "I am tester!";

const hash = crypto.createHash("sha256").update(password).digest();
const keypair = ed.MakeKeypair(hash);

let blockchains = [];
for (const i = 0; i < 20; ++i) {
  let blockchain = new BlockChain(Consensus, keypair, i);
  blockchain.start();
  blockchains.push(blockchain);
}
// test1
setTimeout(() => {
  for (const i = 0; i < 20; ++i) {
    console.log(`${i} --> ${blockchains[i].list_peers()}`);
  }
}, 3000);

// // test2
// function print_blockchian() {
//     for (i = 0; i < 20; ++i) {
//         blockchains[i].print();
//     }
// }

// setInterval(print_blockchian, 10000);
