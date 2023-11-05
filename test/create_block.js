"use strict";

const BlockChain = require("../blockchain");
const Consensus = require("../consensus/pow");

const blockchain = new BlockChain(Consensus);

console.log(blockchain.get_last_block());
