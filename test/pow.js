"use strict";

const crypto = require("crypto");
const ed = require("ed25519");
const BlockChain = require("../blockchain");
const Consensus = require("../consensus/pow");
const Promise = require("bluebird");

let blockchain = new BlockChain(Consensus);

// console.log(blockchain.get_last_block().hash);

const password = "I am tester!";

const hash = crypto.createHash("sha256").update(password).digest();
const keypair = ed.MakeKeypair(hash);

async function create_block(prev_time) {
  return new Promise((resolve, reject) => {
    blockchain.generate_block(keypair, () => {
      console.log(
        `|${blockchain.get_last_block().hash}|${
          blockchain.get_last_block().timestamp - prev_time
        }|`
      );
      resolve();
    });
  });
}

(async () => {
  for (const i = 0; i < 20; ++i) {
    let prev_time = blockchain.get_last_block().timestamp;
    await create_block(prev_time);
  }
})();
