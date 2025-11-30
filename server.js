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
        console.log(`User ${userData._id} joined their room`);
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
const reportRoutes = require('./routes/reports');
const albumAccessRoutes = require('./routes/albumAccess');
const adminRoutes = require('./routes/admin');
const photoApprovalRoutes = require('./routes/photoApprovalRoutes');
const announcementRoutes = require('./routes/announcements');
const { checkMaintenanceMode } = require('./middleware/maintenanceMiddleware');

// Use Routes
// Note: Admin routes and settings/public are NOT protected by maintenance mode
app.use('/api/admin', adminRoutes);
app.use('/api/admin/photos', photoApprovalRoutes);
app.use('/api/settings', require('./routes/settings'));

// Apply maintenance mode check to user-facing routes
app.use('/api/auth', checkMaintenanceMode, authRoutes);
app.use('/api/users', checkMaintenanceMode, userRoutes);
app.use('/api/chat', checkMaintenanceMode, chatRoutes);
app.use('/api/posts', checkMaintenanceMode, postRoutes);
app.use('/api/notifications', checkMaintenanceMode, require('./routes/notifications'));
app.use('/api/reports', checkMaintenanceMode, reportRoutes);
app.use('/api/album-access', checkMaintenanceMode, albumAccessRoutes);
app.use('/api/announcements', checkMaintenanceMode, announcementRoutes);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT} `);
});
