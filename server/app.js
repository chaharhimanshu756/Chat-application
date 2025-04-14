require('dotenv').config(); // Load environment variables
const express = require('express');
const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

// Connect MongoDB
const mongoURI = process.env.MONGO_URI;
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected successfully"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Import Models
const Users = require('./models/Users');
const Conversations = require('./models/Conversations');
const Messages = require('./models/Messages');

// Initialize Express App
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: 'http://localhost:3002' }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const PORT = process.env.PORT || 8000;

// Socket.io
let users = [];
io.on('connection', socket => {
    console.log('🔗 User connected:', socket.id);

    socket.on('addUser', userId => {
        if (userId && !users.some(user => user.userId === userId)) {
            users.push({ userId, socketId: socket.id });
            io.emit('getUsers', users);
        }
    });

    socket.on('sendMessage', async ({ senderId, receiverId, message, conversationId }) => {
        try {
            const receiver = users.find(user => user.userId === receiverId);
            const sender = users.find(user => user.userId === senderId);
            const user = await Users.findById(senderId);

            if (!user) {
                console.error("❌ Sender not found in database");
                return;
            }

            const messageData = {
                senderId,
                message,
                conversationId,
                receiverId,
                user: { id: user._id, fullName: user.fullName, email: user.email }
            };

            if (receiver) {
                io.to(receiver.socketId).to(sender.socketId).emit('getMessage', messageData);
            } else {
                io.to(sender.socketId).emit('getMessage', messageData);
            }
        } catch (error) {
            console.error("❌ Error sending message:", error);
        }
    });

    socket.on('disconnect', () => {
        users = users.filter(user => user.socketId !== socket.id);
        io.emit('getUsers', users);
        console.log("🔌 User disconnected:", socket.id);
    });
});

// Routes
app.get('/', (req, res) => res.send('✅ Welcome to the chat app!'));

// Register User
app.post('/api/register', async (req, res) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) return res.status(400).send('Please fill all required fields');

        const isAlreadyExist = await Users.findOne({ email });
        if (isAlreadyExist) return res.status(400).send('User already exists');

        const hashedPassword = await bcryptjs.hash(password, 10);
        const newUser = new Users({ fullName, email, password: hashedPassword });
        await newUser.save();

        return res.status(200).send('User registered successfully');
    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Login User
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send('Please fill all required fields');

        const user = await Users.findOne({ email });
        if (!user) return res.status(400).send('Invalid email or password');

        const isValidPassword = await bcryptjs.compare(password, user.password);
        if (!isValidPassword) return res.status(400).send('Invalid email or password');

        const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET_KEY, { expiresIn: '1d' });

        await Users.updateOne({ _id: user._id }, { $set: { token } });

        return res.status(200).json({ user: { id: user._id, email: user.email, fullName: user.fullName }, token });
    } catch (error) {
        console.error("❌ Login Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Start Server
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
