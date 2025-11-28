const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./models/Admin');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const createAdmin = async () => {
    await connectDB();

    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username: 'admin' });

        if (existingAdmin) {
            console.log('Admin user already exists!');
            process.exit(0);
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Create admin
        const admin = await Admin.create({
            username: 'admin',
            password: hashedPassword,
            email: 'admin@gthai.com',
            name: 'Super Admin',
            role: 'admin'
        });

        console.log('✅ Admin user created successfully!');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Role: admin');
        console.log('\n⚠️  Please change the password after first login!');

        // Create editor user
        const editorPassword = await bcrypt.hash('editor123', salt);
        const editor = await Admin.create({
            username: 'editor',
            password: editorPassword,
            email: 'editor@gthai.com',
            name: 'Content Editor',
            role: 'editor'
        });

        console.log('\n✅ Editor user created successfully!');
        console.log('Username: editor');
        console.log('Password: editor123');
        console.log('Role: editor');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
