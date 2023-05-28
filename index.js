const express = require("express");
const app = express();
const http = require("http");
const Server = require("socket.io");

// conncect db

async function main() {
  const mysql = require("mysql2/promise");
  const { error, log } = require("console");

  const connection = await mysql.createConnection({
    host: "localhost",
    port: 3306,
    database: "testdatabase",
    user: "root",
    password: "",
  });

  const httpServer = http.createServer(app);

  app.get("/", (req, res) => {
    console.log("heree");
    res.sendFile(__dirname + "/index.html");
  });

  const ioServer = new Server(httpServer); // socket server

  //@ts-ignore
  ioServer.on("connection", (socket) => {
    console.log("Connected!");

    socket.on("create-room", async (data) => {
      const adminUserId = await getAdminUserId();
      console.log("admin ", adminUserId);
      if (!adminUserId) {
        socket.disconnect(`Admins are unavailable!`);
      }
      const roomExists = await checkIfRoomWithParticipantsExists(
        adminUserId ? adminUserId.id : "1",
        data.userId
      );
      if (!roomExists) {
        createChatRoom(adminUserId ? adminUserId.id : "1", data.userId);
      } else {
        //@ts-ignore
        const messages = await getRoomMessages(roomExists.chatroom_id);
        console.log("messages ", messages);
        socket.emit("display-messages", messages);
      }
    });

    socket.on("message", async (message) => {
      const parsedMessage = JSON.parse(message);
      const storeMessage = await createMessage(
        parsedMessage.roomId,
        parsedMessage.creatorId,
        parsedMessage.receiverId,
        parsedMessage.content
      );
      if (storeMessage?.affectedRows) {
        socket.emit("display-messages", { content: parsedMessage.content });
      }
    });
  });

  httpServer.listen(3000, () => console.log("Listening on port 3000"));

  async function createChatRoom(participant1, participant2) {
    try {
      const result = await connection.execute(
        `INSERT INTO chatrooms (participant_1_id, participant_2_id) VALUES (${participant1}, ${participant2})`
      );
      return result[0];
    } catch (err) {
      return null;
    }
  }

  async function checkIfRoomWithParticipantsExists(participant1, participant2) {
    const result = await connection.execute(
      `SELECT chatroom_id from chatrooms WHERE participant_1_id=${participant1} AND participant_2_id=${participant2}`
    );
    return result[0][0];
  }

  async function createMessage(roomId, creator, receiver, messageContent) {
    console.log("type ", typeof messageContent);
    try {
      const result = await connection.execute(
        `INSERT INTO messages (room_id, creator_id, receiver_id, content) VALUES (${roomId},${creator},${receiver},'${messageContent.toString()}')`
      );
      return result[0];
    } catch (err) {
      console.log("--", err);
      return null;
    }
  }

  async function getRoomMessages(roomId) {
    try {
      const result = await connection.execute(
        `SELECT m.*, creator.name AS creator_name, receiver.name AS receiver_name
		FROM messages AS m
		JOIN users AS creator ON m.creator_id = creator.id
		JOIN users AS receiver ON m.receiver_id = receiver.id
		WHERE m.room_id=${roomId}`
      );
      return result[0];
    } catch (err) {
      console.log("err ", err);
      return null;
    }
  }

  async function getAdminUserId() {
    try {
      const result = await connection.execute(
        `SELECT (id) FROM USERS WHERE role='admin'`
      );
      return result[0][0];
    } catch (err) {
      return null;
    }
  }
}

main();
