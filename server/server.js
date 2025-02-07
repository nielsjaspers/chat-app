const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

// Connect to MongoDB (the host 'mongo' matches the service name in docker-compose.yml)
const mongoUrl = process.env.MONGO_URL || 'mongodb://mongo:27017/chat';
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Define a Message schema and model
const messageSchema = new mongoose.Schema({
  userId: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Provide an endpoint to fetch all existing messages
app.get('/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  // Listen for new messages from the client
  socket.on('newMessage', async (data) => {
    // data should include { userId, message }
    const msg = new Message({
      userId: data.userId,
      message: data.message,
      timestamp: new Date()
    });
    try {
      await msg.save();
      // Broadcast the message to all connected clients
      io.emit('message', msg);
    } catch (error) {
      console.error('Error saving message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
