"use strict";

export class Pos {
  constructor(blockchain) {
    this.difficulty_ = 4294967295; // ~uint64(0) >> 32
    this.time_stamp_ = new Date().getTime();
    this.state_ = "Idle";
    this.block_chain_ = blockchain;
  }
  prepared() {
    return this.state_ == "Idle";
  }
  calc_difficulty(block) {
    const prev = this.block_chain_.get_last_block();
    if (!prev) return this.difficulty_;
    const prev_prev = this.block_chain_.get_hash(prev.hash);
    if (!prev_prev) return prev.difficulty;

    const TargetSpacing = 10 * 60;
    const TargetTimespan = 7 * 24 * 60 * 60;
    const Interval = TargetTimespan / TargetSpacing;
    const ActualSpacing = prev.timestamp - prev_prev.timestamp;
    this.difficulty_ =
      (prev.difficulty * ((Interval - 1) * TargetSpacing + 2 * ActualSpacing)) /
      ((TargetSpacing + 1) * TargetSpacing);
  }
  make_consensus(block_data) {
    this.state_ = "Busy";
    this.calc_difficulty(block_data);

    const self = this;
    setImmediate(function make_proof(block) {
      const time_period = self.time_stamp_ - block_data.get_timestamp();
      if (time_period > 3600 * 1000) {
        self.state_ = "Idle";
        block.emit("consensus failed");
        return;
      }

      const amount = self.block_chain_.get_amount();
      block.set_consensus_data({
        difficulty: self.difficulty_,
        timestamp: self.time_stamp_,
        amount: amount,
      });

      var hash = block.calc_block_hash();
      if (parseInt(hash, 16) < self.difficulty_ * amount) {
        self.state_ = "Idle";
        block.emit("consensus completed");
      } else {
        setTimeout(make_proof, 1000, block);
      }
    }, block_data);
  }

  /**
   *
   * @param {*} block 验证区块
   * @returns 布尔值
   */
  verify(block) {
    const hash = block.calc_block_hash();
    if (hash != block.get_hash()) return false;

    const difficulty = block.get_consensus_data().difficulty;
    const amount = block.get_consensus_data().amount;

    // todo: check the amount within the block timestamp

    const target = difficulty * amount;
    if (parseInt(hash, 16) < target) {
      return true;
    }
    return false;
  }
}
