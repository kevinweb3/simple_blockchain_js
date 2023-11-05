"use strict";

const Block = require("./block");
const genesis_block = require("./genesis_block.json");
const Node = require("./network");
const Account = require("./account");
const Transaction = require("./transaction").Transaction;
const TxInput = require("./transaction").TxInput;
const TxOutput = require("./transaction").TxOutput;
const Msg = require("./message");
const MessageType = require("./message").type;
const Promise = require("bluebird");
const level = require("level");
const Crypto = require("./crypto");

const Pbft = require("./consensus/pbft");
const pbft = false;

export class BlockChain {
  constructor(Consensus, keypair, id, is_bad = false) {
    // todo
    this.pending_block_ = {};
    this.tx_pool = {};
    // this.chain_ = [];

    this.is_bad_ = is_bad;
    this.pbft_ = new Pbft(this);

    // ///////////////////////////////////////
    this.genesis_block_ = genesis_block;

    this.account_ = new Account(keypair, id);
    this.consensus_ = new Consensus(this);
    this.node_ = null;
  }
  async start() {
    this.db_ = level(`/tmp/data_${this.get_account_id()}`);
    try {
      // load blocks
      const last = await this.db_.get("last_block");
      this.last_block_ = JSON.parse(last);
      console.log(
        `node: ${this.get_account_id()} last block: ${this.last_block_.height}`
      );
    } catch (err) {
      // empty chain
      this.last_block_ = genesis_block;
      this.save_last_block();
      console.log(`node: ${this.get_account_id()} empty`);
    }

    this.node_ = new Node(this.get_account_id());
    this.node_.on("message", this.on_data.bind(this));
    this.node_.start();
    // start loop
    const self = this;
    setTimeout(function next_loop() {
      self.loop(function () {
        setTimeout(next_loop, 1000);
      });
    }, 5000);
  }
  loop(cb) {
    const self = this;
    if (this.consensus_.prepared()) {
      if (!self.is_bad_) {
        this.generate_block(this.get_account_keypair(), () => {
          // broadcast block
          const block = self.get_last_block();
          console.log(
            `node: ${self.get_account_id()} generate block! block height: ${
              block.height
            } hash: ${block.hash}`
          );
        });
      } else {
        self.fork();
      }
    }
    cb();
  }

  async save_block(block) {
    if (!block) block = this.last_block_;
    // query from db via hash
    // if not exist, write into db, else do nothing
    if (this.pending_block_[block.hash]) {
      delete this.pending_block_[block.hash];
    }
    await this.db_.put(block.hash, JSON.stringify(block));
    await this.db_.put("last_block", JSON.stringify(block));
    // console.log(`save block: ${block.hash} to db`);

    // tx
    if (!block.transactions) {
      return;
    }
    for (const i = 0; i < block.transactions.length; ++i) {
      const tx = block.transactions[i];
      if (this.tx_pool[tx.id]) {
        delete this.tx_pool[tx.id];
        // console.log(`node ${this.get_account_id()} delete tx ${tx.id}`);
      }
      await this.db_.put(tx.id, JSON.stringify(tx));
    }
  }
  async save_last_block() {
    await this.save_block();
  }

  generate_block(keypair, cb) {
    // load transactions
    const tx = [this.create_coinbase()];
    const i = 0;
    for (const key in this.tx_pool) {
      if (i == 10) break;
      tx.push(this.tx_pool[key]);
      i++;
      console.log(`node ${this.get_account_id()} load tx ${key}`);
    }
    // create block
    const block = new Block(
      {
        keypair: keypair,
        previous_block: this.last_block_,
        transactions: tx,
      },
      this.consensus_
    );
    // make proof of the block/mine
    const self = this;
    block.on("block completed", (data) => {
      if (
        data.previous_hash == self.last_block_.hash &&
        data.height == self.last_block_.height + 1
      ) {
        // console.log("block completed");
        self.commit_block(data);

        self.broadcast(Msg.block(data));

        if (cb) cb();
      } else {
        // [fork]
        self.process_fork(data);
      }
    });
  }

  commit_block(block_data) {
    if (pbft && !this.is_bad_) {
      const block = new Block();
      block.set_data(block_data);
      const self = this;
      block.on("consensus completed", (data) => {
        self.last_block_ = data;
        self.save_last_block();
      });
      this.pbft_.make_consensus(block);
    } else {
      this.last_block_ = block_data;
      this.save_last_block();
    }
  }

  get_height() {
    return this.last_block_.height;
  }

  async get_from_db(hash) {
    // query block with hash value
    try {
      const block_data = await this.db_.get(hash);
      const block = JSON.parse(block_data);
      return block;
    } catch (err) {
      return null;
    }
  }

  async iterator_back(cb, hash) {
    if (!hash) {
      return;
    }
    const block = await this.get_from_db(hash);
    const res = cb(block);
    if (res) await this.iterator_back(cb, block.previous_hash);
  }

  async iterator_forward(cb, hash) {
    if (!hash) {
      return;
    }
    const block = await this.get_from_db(hash);
    await this.iterator_forward(cb, block.previous_hash);
    cb(block);
  }

  get_last_block() {
    return this.last_block_;
  }

  get_genesis_block() {
    return this.generate_block_;
  }

  get_amount() {
    // get the amount of the account
    return this.account_.get_amount();
  }

  get_account_id() {
    // get the node id
    return this.account_.get_id();
  }

  get_account_keypair() {
    return this.account_.get_key();
  }

  get_public_key() {
    return this.get_account_keypair().publicKey.toString("hex");
  }

  send_msg(socket, data) {
    this.node_.send(socket, data);
  }

  broadcast(data) {
    this.node_.broadcast(data);
  }

  list_peers() {
    return this.node_.list_peers();
  }

  sync() {
    const peers = this.list_peers();
    const index = Math.floor(Math.random() * peers.length);
    const id = peers[index];
    this.send_msg(parseInt(id), Msg.sync({ id: this.get_account_id() }));
  }

  async verify_transaction(tx) {
    const input_amount = 0;
    for (const i = 0; i < tx.input.length; ++i) {
      const input = tx.input[i];
      // coinbase
      if (input.id == null) {
        // check milestone
        if (tx.output[0].amount == 50) {
          return true;
        } else {
          return false;
        }
      }
      const vout = null;
      if (this.tx_pool[input.id]) {
        vout = this.tx.tx_pool[input.id];
      } else {
        vout = await this.get_from_db(input.id);
      }
      if (!vout) {
        // invalid vout
        return false;
      }
      vout = vout.output[input.index];
      const res = Crypto.verify_signature(
        JSON.stringify(vout),
        input.ScriptSig,
        vout.ScriptPubKey
      );
      if (!res) {
        return false;
      }
      input_amount += vout.amount;
    }
    const output_amount = 0;
    for (i = 0; i < tx.output.length; ++i) {
      output_amount += tx.output[i].amount;
    }
    if (input_amount < output_amount) {
      return false;
    }
    return true;
  }

  // verify the block is valid
  async verify(block) {
    // verify the block signature
    if (!Block.verify_signature(block)) return false;
    // verify consensus
    if (!this.consensus_.verify(block)) {
      // [fork] slot
      this.save_block(block);
      return false;
    }
    // verify transactions
    const tx = block.transactions;
    if (tx) {
      for (const i = 0; i < tx.length; ++i) {
        try {
          if (await this.db_.get(tx[i].id)) {
            // [fork] transaction exists
            return false;
          }
        } catch (err) {
          // nothing
        }
        if (!(await this.verify_transaction(tx[i]))) return false;
      }
    }
    return true;
  }

  process_fork(block) {
    if (
      block.previous_hash != this.last_block_.hash &&
      block.height == this.last_block_.height + 1
    ) {
      // [fork] right height and different previous block
      this.save_block(block);
    } else if (
      block.previous_hash == this.last_block_.hash &&
      block.height == this.last_block_.height &&
      block.hash != this.last_block_.hash
    ) {
      // [fork] same height and same previous block, but different block id
      this.save_block(block);
    }
  }

  async on_data(msg) {
    switch (msg.type) {
      case MessageType.Block:
        {
          const block = msg.data;
          // console.log(`node: ${this.get_account_id()} receive block: height ${block.height}`);
          // check if exist
          const query = await this.get_from_db(block.hash);
          if (this.pending_block_[block.hash] || query) {
            // console.log("block already exists");
            return;
          }
          // verify
          if (!(await this.verify(block))) {
            // console.log("verify failed");
            return;
          }

          this.pending_block_[block.hash] = block;

          // add to chain
          if (
            block.previous_hash == this.last_block_.hash &&
            block.height == this.last_block_.height + 1
          ) {
            // console.log("on block data");
            this.commit_block(block);
            // console.log("----------add block");
          } else {
            // [fork]
            this.process_fork(block);
          }
          // broadcast
          this.broadcast(msg);
        }
        break;
      case MessageType.Transaction:
        {
          // check if exist(pending or in chain) verify, store(into pending) and broadcast
          const tx = msg.data;
          if (this.tx_pool[tx.id]) {
            // already exists
            return;
          }
          this.tx_pool[tx.id] = tx;
          // verify transaction
          const res = await this.verify_transaction(tx);
          if (!res) {
            delete this.tx_pool[tx.id];
          } else {
            // console.log(`node ${this.get_account_id()} store tx ${tx.id}`);
          }

          // broadcast
          this.broadcast(msg);
        }
        break;
      case MessageType.Sync:
        {
          console.log(`${this.get_account_id()} receive sync info`);
          const data = msg.data;
          const id = data.id;
          if (data.hash) {
            const block = await this.get_from_db(data.hash);
            this.send_msg(
              id,
              Msg.sync_block({ id: this.get_account_id(), block: block })
            );
            console.log(
              `---> ${this.get_account_id()} send sync block: ${block.height}`
            );
          } else {
            this.send_msg(
              id,
              Msg.sync_block({
                id: this.get_account_id(),
                last_block: this.last_block_,
              })
            );
            console.log(
              `---> ${this.get_account_id()} send sync last block: ${
                this.last_block_.height
              }`
            );
          }
        }
        break;
      case MessageType.SyncBlock:
        {
          const data = msg.data;
          const id = data.id;
          const block = null;
          if (data.hasOwnProperty("last_block")) {
            block = data.last_block;
            this.last_block_ = block;
            console.log(
              `++++ ${this.get_account_id()} change last block: ${block.height}`
            );
          } else {
            block = data.block;
          }
          console.log(
            `<--- ${this.get_account_id()} receive sync block: ${
              block.height
            }\n`
          );

          this.save_block(block);
          const hash = block.previous_hash;
          const res = null;
          if (hash) {
            res = await this.get_from_db(hash);
          }
          if (!res) {
            console.log(
              `---> ${this.get_account_id()} continue sync hash: ${hash}`
            );
            this.send_msg(
              id,
              Msg.sync({ id: this.get_account_id(), hash: hash })
            );
          } else {
            console.log(`==== ${this.get_account_id()} complete syning!`);
          }
        }
        break;
      default:
        if (pbft && !this.is_bad_) {
          this.pbft_.processMessage(msg);
        } else {
          console.log("unkown msg");
          console.log(msg);
        }
        break;
    }
  }
  // print() {
  //     // todo chain_
  //     const output = '';
  //     for (const i = 0; i < this.chain_.length; ++i) {
  //         const height = this.chain_[i].height;
  //         const hash = this.chain_[i].hash.substr(0, 6);
  //         const generator_id = this.chain_[i].consensus_data.generator_id;
  //         if (generator_id == undefined) generator_id = null;
  //         output += `(${height}:${hash}:${generator_id}) -> `;
  //     }
  //     console.log(`node: ${this.get_account_id()} ${output}`);
  // }
  // async fork() {
  //     console.log('----------fork----------');
  //     // load transactions
  //     const tx1 = [{
  //         amount: 1000,
  //         recipient: 'bob',
  //         sender: 'alice'
  //     }];
  //     // create block
  //     const block1 = new Block({
  //         "keypair": this.get_account_keypair(),
  //         "previous_block": this.last_block_,
  //         "transactions": tx1
  //     }, this.consensus_);
  //     // make proof of the block/mine
  //     const self = this;
  //     const block_data1 = await new Promise((resolve, reject) => {
  //         block1.on('block completed', (data) => {
  //             if (data.height == self.last_block_.height + 1) {
  //                 resolve(data);
  //             } else {
  //                 reject('block1 failed');
  //             }
  //         });
  //     });

  //     // load transactions
  //     const tx2 = [{
  //         amount: 1000,
  //         recipient: 'cracker',
  //         sender: 'alice'
  //     }];
  //     // create block
  //     const block2 = new Block({
  //         "keypair": this.get_account_keypair(),
  //         "previous_block": this.last_block_,
  //         "transactions": tx2
  //     }, this.consensus_);
  //     const block_data2 = await new Promise((resolve, reject) => {
  //         block2.on('block completed', (data) => {
  //             if (data.height == self.last_block_.height + 1) {
  //                 resolve(data);
  //             } else {
  //                 reject('block2 failed');
  //             }
  //         });
  //     });

  //     const i = 0;
  //     for (const id in this.node_.peers_) {
  //         const socket = this.node_.peers_[id];
  //         if (i % 2 == 0) {
  //             const msg1 = Msg.block(block_data1);
  //             this.node_.send(socket, msg1);
  //         } else {
  //             const msg2 = Msg.block(block_data2);
  //             this.node_.send(socket, msg2);
  //         }
  //         i++;
  //     }
  //     console.log("fork");
  //     this.commit_block(block_data1);
  // }
  create_coinbase() {
    const input = new TxInput(
      null,
      -1,
      `${new Date()} node: ${this.get_account_id()} coinbase tx`
    );
    const output = new TxOutput(50, this.get_public_key());
    const tx = new Transaction([input], [output]);
    return tx;
  }

  async get_utxo(cb) {
    const publicKey = this.get_public_key();
    const spentTXOs = {};
    await this.iterator_back((block) => {
      const txs = block.transactions;
      // tx
      for (const i = 0; i < txs.length; ++i) {
        const tx = txs[i];
        const transaction_id = tx.id;
        // output
        for (const j = 0; j < tx.output.length; ++j) {
          const output = tx.output[j];
          // owns
          if (output.ScriptPubKey == publicKey) {
            // not spent
            if (
              spentTXOs.hasOwnProperty(transaction_id) &&
              spentTXOs[transaction_id].hasOwnProperty(j)
            ) {
              continue;
            } else {
              if (!cb(transaction_id, j, output)) return false;
            }
          }
        }
        // input
        for (j = 0; j < tx.input.length; ++j) {
          const input = tx.input[j];
          // not coinbase
          if (input.id != null && input.index != -1) {
            if (!spentTXOs[input.id]) {
              spentTXOs[input.id] = [];
            }
            spentTXOs[input.id].push(input.index);
          }
        }
      }
      return true;
    }, this.get_last_block().hash);
  }
  async get_balance() {
    const value = 0;
    await this.get_utxo((transaction_id, index, vout) => {
      value += vout.amount;
      return true;
    });
    return value;
  }
  async create_transaction(to, amount) {
    const value = 0;
    const input = [];
    const output = [];
    const self = this;
    const tx = null;
    await this.get_utxo((transaction_id, index, vout) => {
      value += vout.amount;
      const signature = Crypto.sign(
        self.get_account_keypair(),
        JSON.stringify(vout)
      );
      input.push(new TxInput(transaction_id, index, signature));
      if (value >= amount) {
        output.push(new TxOutput(amount, to));
        if (value > amount)
          output.push(new TxOutput(value - amount, self.get_public_key()));
        tx = new Transaction(input, output);
        // stop
        return false;
      }
      return true;
    });
    if (value < amount) {
      throw new Error("amount is not enough!");
    }
    if (tx == null) {
      throw new Error("create transaction failed!");
    }
    this.tx_pool[tx.id] = tx;
    this.broadcast(Msg.transaction(tx));

    return tx;
  }
}
