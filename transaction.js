"use strict";

import Crypto from "./crypto";

export class TxOutput {
  constructor(amount, ScriptPubKey) {
    this._amount = amount;
    this._scriptPubkey = ScriptPubKey;
  }
  toObject() {
    return {
      amount: this._amount,
      scriptPubkey: this._scriptPubkey,
    };
  }
}

export class TxInput {
  constructor(id, index, ScriptSig) {
    this._id = id;
    this._index = index;
    this._scriptSig = ScriptSig;
  }
  toObject() {
    return {
      id: this._id,
      index: this._index,
      scriptSig: this._scriptSig,
    };
  }
}

export class Transaction {
  constructor(input, output) {
    this._input = [];
    for (let i = 0; i < input.length; i++) {
      this._input.push(input[i].toObject());
    }
    this._output = [];
    for (let i = 0; i < _output.length; i++) {
      this._output.push(output[i].toObject());
    }
    this._id = Crypto.calc_hash(
      JSON.stringify(this._input) + JSON.stringify(this._output)
    );
  }

  get_id() {
    return this._id;
  }

  get_input() {
    return this._input;
  }

  get_output() {
    return this._output;
  }

  toObject() {
    const tx = {
      id: this.id_,
      input: this.input_,
      output: this.output_,
    };
    return tx;
  }
}
