const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

dotenv.config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

const locations = [
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
    { name: 'Chiang Mai', lat: 18.7883, lng: 98.9853 },
    { name: 'Phuket', lat: 7.8804, lng: 98.3923 }
];

const lookingForOptions = ['Relationship', 'Friends', 'Fun', 'Chat', 'Networking', 'Date'];

const bios = [
    "ชอบเที่ยวธรรมชาติ หาเพื่อนคุยครับ",
    "โสดครับ ทักได้",
    "หาคนจริงใจ",
    "ชอบออกกำลังกาย",
    "คุยเก่ง เป็นกันเอง",
    "หาแฟนครับ",
    "เหงาๆ หาเพื่อน",
    "ชอบกินหมูกระทะ",
    "สายบุญครับ",
    "ทักมาคุยกันได้นะ",
    "Looking for good vibes",
    "Gym addict",
    "Coffee lover",
    "Traveler",
    "Just chilling"
];

const names = [
    "Ton", "Bank", "Jay", "Oat", "Arm", "Benz", "Boat", "Champ", "Dew", "Earth",
    "Fiat", "Game", "Golf", "Gun", "Ice", "Jack", "James", "Keng", "Korn", "Leo",
    "Man", "Mark", "Max", "Mick", "New", "Nick", "Night", "Non", "Not", "Off",
    "Ohm", "Oil", "Pang", "Pat", "Paul", "Pete", "Pond", "Pop", "Porsche", "Prem",
    "Prince", "Q", "Ruj", "Safe", "Saint", "Sea", "Sun", "Tae", "Tar", "Team",
    "Tee", "Ten", "Time", "Title", "Top", "Tor", "Toy", "Up", "View", "Win",
    "Yacht", "Zee", "Boss", "Bright", "Win", "Sky"
];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

const getRandomLocation = () => {
    const loc = getRandomElement(locations);
    // Add small random offset (approx within 5-10km)
    const latOffset = (Math.random() - 0.5) * 0.1;
    const lngOffset = (Math.random() - 0.5) * 0.1;
    return {
        lat: loc.lat + latOffset,
        lng: loc.lng + lngOffset
    };
};

const importData = async () => {
    try {
        await connectDB();

        // Optional: Clear existing fake users
        // await User.deleteMany({ isFake: true });
        // console.log('Existing fake users removed');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('12345678', salt);

        const users = [];

        for (let i = 1; i <= 66; i++) {
            const location = getRandomLocation();
            const randomName = getRandomElement(names) + " " + Math.floor(Math.random() * 100);

            // Generate random lookingFor (1-3 items)
            const numLookingFor = Math.floor(Math.random() * 3) + 1;
            const userLookingFor = [];
            for (let j = 0; j < numLookingFor; j++) {
                const item = getRandomElement(lookingForOptions);
                if (!userLookingFor.includes(item)) userLookingFor.push(item);
            }

            users.push({
                username: `fakeuser_${i}_${Date.now()}`, // Ensure uniqueness
                password: hashedPassword,
                email: `fakeuser${i}_${Math.floor(Math.random() * 10000)}@example.com`,
                name: randomName,
                img: `/pic_guy/${i}.png`, // Assuming images are named 1.png to 66.png
                cover: '/cover_default.png',
                age: Math.floor(Math.random() * (38 - 18 + 1)) + 18, // 18-38
                height: Math.floor(Math.random() * (190 - 160 + 1)) + 160,
                weight: Math.floor(Math.random() * (90 - 50 + 1)) + 50,
                country: 'Thailand',
                lookingFor: userLookingFor,
                bio: getRandomElement(bios),
                isOnline: Math.random() > 0.5,
                isPublic: true,
                lat: location.lat,
                lng: location.lng,
                isFake: true,
                gallery: [], // Can add logic to add some random images to gallery if needed
                privateAlbum: []
            });
        }

        await User.insertMany(users);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

const destroyData = async () => {
    try {
        await connectDB();
        await User.deleteMany({ isFake: true });
        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

if (process.argv[2] === '-d') {
    destroyData();
} else {
    importData();
}
