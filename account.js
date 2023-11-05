"use strict";

class Account {
  constructor(key, id) {
    this._key = key;
    this._id = id;
    this._amount = 0;
  }

  getKey() {
    return this._key;
  }

  getId() {
    return this._id;
  }

  getAmount() {
    return this._amount;
  }

  setAmount(amount) {
    this._amount = amount;
  }
}

export default Account;
