const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

const User = require('./models/User'); // Import User model

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('setup', async (userData) => {
        socket.join(userData._id);
        socket.userId = userData._id; // Store userId in socket session
        socket.emit('connected');

        // Set user online
        try {
            const user = await User.findByIdAndUpdate(userData._id, { isOnline: true }, { new: true });
            io.emit('user status', {
                userId: userData._id,
                isOnline: true,
                userName: user.name,
                userImg: user.img
            });
        } catch (error) {
            console.error('Error setting user online:', error);
        }
    });

    socket.on('join chat', (room) => {
        socket.join(room);
        console.log('User joined room: ' + room);
    });

    socket.on('typing', (room) => {
        socket.to(room).emit('typing');
    });

    socket.on('stop typing', (room) => {
        socket.to(room).emit('stop typing');
    });

    socket.on('disconnect', async () => {
        console.log('Client disconnected');
        if (socket.userId) {
            // Set user offline
            try {
                const user = await User.findByIdAndUpdate(socket.userId, { isOnline: false }, { new: true });
                io.emit('user status', {
                    userId: socket.userId,
                    isOnline: false,
                    userName: user.name,
                    userImg: user.img
                });
            } catch (error) {
                console.error('Error setting user offline:', error);
            }
        }
    });
});

// Make io accessible to our router
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('API is running...');
});

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chat');
const postRoutes = require('./routes/posts');

// Use Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/posts', postRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
