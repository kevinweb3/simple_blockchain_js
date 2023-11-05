"use strict";

import crypto from "crypto";
import ed from "ed25519";

function calc_hash(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function sign(key, data) {
  return ed.Sign(Buffer.from(data, "utf-8"), key).toString("hex");
}

function verify_signature(data, signature, publickey) {
  return ed.Verify(
    Buffer.from(data, "utf-8"),
    Buffer.from(signature, "hex"),
    Buffer.from(publickey, "hex")
  );
}

module.exports = {
  calc_hash,
  sign,
  verify_signature,
};
