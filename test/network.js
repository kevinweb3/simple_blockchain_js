"use strict";

const Node = require("../network");

const nodes = [];
for (const i = 0; i < 20; ++i) {
  let node = new Node(i);
  nodes.push(node);
}

for (i = 0; i < 1; ++i) {
  nodes[i].start();
}
