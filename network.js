"use strict";

import net from "net";
import Msg from "./message";
const EventEmitter = require("events").EventEmitter;
import Promise from "bluebird";

const port = 3000;

class Node extends EventEmitter {
  constructor(id) {
    super();

    this._id = id;
    this._peers = {};
    let self = this;
    this._server = net.createServer((socket) => {
      socket.setEncoding("utf8");
      socket.on("data", (data) => {
        self.on_data(data, socket);
      });
      socket.on("end", () => {
        self.remove_peer(socket);
      });
      this._server.listen(port + id);
    });
  }

  async start() {
    for (let i = 0; i < 5; i++) {
      const remote_id = Math.floor(Math.random() * 20);
      if (remote_id !== this._id && !this._peers[remote_id]) {
        const self = this;
        const socket = net.createConnection({
          port: port + remote_id,
        });
        await new Promise((resolve, reject) => {
          socket.on("connect", () => {
            resolve();
          });
          socket.on("error", () => {
            resolve();
          });
          socket.setEncoding("utf8");
          socket.on("data", (data) => {
            self.on_data(data, socket);
          });
        });

        const data = Msg.connection(self._id);
        self.send(socket, data);
        self.add_peer(socket, remote_id);
      }
    }
  }

  on_data(data, socket) {
    try {
      const arr = data.split("\r\n");
      for (let i = 0; i < arr.length; i++) {
        if (arr[i] === "") continue;
        const obj = JSON.parse(arr[i]);
        if (obj.type === Msg.type.Connection) {
          const remote_id = obj.data;
          this.add_peer(socket, remote_id);
        } else {
          this.emit("message", obj);
        }
      }
    } catch (err) {
      console.log(err);
      console.log(err.message);
      console.log(data);
      console.log(arr.length);
      throw new Error();
    }
  }

  send(socket, data) {
    if (typeof socket === "number") {
      socket = this._peers[socket];
    }
    if (typeof socket === "object") {
      data = JSON.stringify(data);
    }
    socket.write(data + "\r\n");
  }

  broadcast(data) {
    for (const index in this._peers) {
      const socket = this._peers[index];
      this.send(socket, data);
    }
  }

  add_peer(socket, remote_id) {
    if (!this.peers_[remote_id]) {
      this.peers_[remote_id] = socket;
    }
  }

  remove_peer(socket) {
    for (var index in this.peers_) {
      if (this.peers_[index] == socket) {
        delete this.peers_[index];
        break;
      }
    }
  }

  list_peers() {
    let peer_ids = [];
    for (var index in this.peers_) {
      peer_ids.push(index);
    }
    return peer_ids;
  }
}

export default Node;
