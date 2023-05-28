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
    database: "distributed-e-commerce-db",
    user: "root",
    password: "",
  });

  const httpServer = http.createServer(app);

  // app.get("/", (req, res) => {
  //   console.log("heree");
  //   // res.sendFile(__dirname + "/index.html");
  // });

  const ioServer = new Server(httpServer); // socket server

  //@ts-ignore
  ioServer.on("connection", (socket) => {
    console.log("Connected!");
    // console.log(socket);

    socket.on("create-room", async (data) => {
      const adminUserId = await getAdminUserId();
      if (!adminUserId) {
        socket.disconnect(`Admins are unavailable!`);
      }
      const roomExists = await checkIfRoomWithParticipantsExists(
        adminUserId.id,
        data.userId
      );
      if (!roomExists) {
        createChatRoom(adminUserId.id, data.userId);
        // console.log('dd ', {participant1:roomExists.participant_1_id, participant2: roomExists.participant_2_id})
        // socket.emit('display-message',JSON.stringify({participant1:roomExists.participant_1_id, participant2: roomExists.participant_2_id}))
      } else {
        //@ts-ignore
        socket.emit('display-message',JSON.stringify({participant1:roomExists.participant_1_id, participant2: roomExists.participant_2_id}))
        const messages = await getRoomMessages(roomExists.chatRoom_id);
        socket.emit("display-messages", { messages: messages });
      }
    });
    
    socket.on("message", async (message) => {
      
      const parsedMessage = JSON.parse(message);

   
      const getRoom = await checkIfRoomWithParticipantsExists(parsedMessage.creatorId, parsedMessage.receiverId)
      

      const storeMessage = await createMessage(
        getRoom.chatRoom_id,
        parsedMessage.creatorId,
        parsedMessage.receiverId,
        parsedMessage.content
      );

      if (storeMessage?.affectedRows) {
        const messages = await getRoomMessages(getRoom.chatRoom_id)
        socket.emit("display-messages", { messages: messages });
      }
    });
  });

  httpServer.listen(4000, () => console.log("Listening on port 4000"));

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
      `SELECT * from chatrooms WHERE participant_1_id=${participant1} AND participant_2_id=${participant2} OR participant_1_id=${participant2} AND participant_2_id=${participant1}`
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
		WHERE m.room_id=${roomId} ORDER BY created_at ASC;` 
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
