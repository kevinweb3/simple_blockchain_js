"use strict";

const slot = require("./slot");

export class DPos {
  constructor(blockchain) {
    this._last_slot = -1;
    this._blockchain = blockchain;
  }

  prepared() {
    const current_slot = slot.get_slot_number();
    const current_id = current_slot % slot.delegates;

    if (current_id !== this._blockchain.get_account_id()) {
      return false;
    }

    if (current_slot === this._last_slot) {
      return false;
    }

    this._last_slot = current_slot;
    return true;
  }

  make_consensus(block_data) {
    const self = this;
    setImmediate((block) => {
      const time_stamp = block.get_timestamp();
      const block_slot = slot.get_slot_number(time_stamp);
      const target_id = block_slot % slot.delegates;

      const current_slot = slot.get_slot_number();
      const current_id = current_slot % slot.delegates;

      if (target_id != current_id) {
        block.emit("consensus failed");
        return;
      }

      if (target_id != self.block_chain_.get_account_id()) {
        block.emit("consensus failed");
        return;
      }
      block.set_consensus_data({
        generator_id: self.block_chain_.get_account_id(),
      });
      block.emit("consensus completed");
    }, block_data);
  }

  verify(block) {
    const time_stamp = block.timestamp;
    const block_slot = slot.get_slot_number(time_stamp);
    const id = block_slot % slot.delegates;
    if (id != block.consensus_data.generator_id) return false;
    return true;
  }
}
