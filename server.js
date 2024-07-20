const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const xlsx = require('xlsx');
const app = express();
const server = http.createServer(app);
const socketIo = require('socket.io');
const io = socketIo(server, {
    transports: ['websocket']
});

const PORT = process.env.PORT || 3000;
const dataFolder = path.join(__dirname, 'data');

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware to parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve client-side socket.io script
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, '/node_modules/socket.io/client-dist/socket.io.js'));
});

// Handle real-time connections
io.on('connection', (socket) => {
    console.log('A user connected');
    socket.on('joinEvent', (eventFilename) => {
        console.log('joinEvent received:', eventFilename); // Log joinEvent

        const eventFilePath = path.join(__dirname, 'data', `${eventFilename}.json`);
        fs.readFile(eventFilePath, 'utf8', (err, data) => {
            if (!err) {
                const eventData = JSON.parse(data);
                socket.join(eventFilename);
                socket.emit('initialData', eventData);
            } else {
                console.error('Error reading event data:', err);
            }
        });

        socket.on('checkboxChange', ({ index, arrived }) => {
            const eventFilePath = path.join(__dirname, 'data', `${eventFilename}.json`);
            console.log(`Checkbox change received: ${index}, ${arrived}`);
            fs.readFile(eventFilePath, 'utf8', (err, data) => {
                if (!err) {
                    const eventData = JSON.parse(data);
                    eventData.guests[index].arrived = arrived;
                    fs.writeFile(eventFilePath, JSON.stringify(eventData, null, 2), (err) => {
                        if (!err) {
                            io.to(eventFilename).emit('guestUpdated', { index, ...eventData.guests[index] });
                        } else {
                            console.error('Error writing JSON file:', err);
                        }
                    });
                } else {
                    console.error('Error reading JSON file:', err);
                }
            });
        });
    });
});

// Route to render login page
app.get('/', (req, res) => {
    res.render('login');
});

// Route to handle login form submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin') {
        res.redirect('/admin-dashboard');
    } else {
        res.send('Invalid username or password');
    }
});

// Route to render admin dashboard
app.get('/admin-dashboard', (req, res) => {
    const currentDate = new Date().toISOString().slice(0, 10);
    fs.readdir(dataFolder, (err, files) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const events = files.map(file => {
            const fileName = file.replace('.json', '');
            const eventFilePath = path.join(dataFolder, file);
            const eventData = JSON.parse(fs.readFileSync(eventFilePath, 'utf8'));
            return {
                fileName,
                eventName: eventData.eventName,
                eventDate: eventData.eventDate
            };
        });

        res.render('admin-dashboard', { events, currentDate });
    });
});

// Route to render edit event page
app.get('/edit-event/:filename', (req, res) => {
    const fileName = req.params.filename;
    const eventFilePath = path.join(dataFolder, `${fileName}.json`);

    if (!fs.existsSync(eventFilePath)) {
        res.status(404).send('Event not found');
        return;
    }

    const eventData = JSON.parse(fs.readFileSync(eventFilePath, 'utf8'));
    res.render('edit-event', { eventData, filename: fileName });
});

// Route to handle POST request to create event
app.post('/create-event', upload.single('eventFile'), (req, res) => {
    const { eventName, eventDate, jsonFilename } = req.body;

    if (!eventName || !eventDate || !jsonFilename || !req.file) {
        return res.status(400).send('Event Name, Event Date, JSON Filename, and Event File are required.');
    }

    const buffer = req.file.buffer;

    try {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });

        const guests = rows.slice(1).map(row => ({
            name: row[0],
            tableNumber: row[1],
            arrived: false
        }));

        const eventData = {
            eventName: eventName,
            eventDate: eventDate,
            guests: guests
        };

        const targetJsonFilePath = path.join(dataFolder, `${jsonFilename}.json`);
        fs.writeFileSync(targetJsonFilePath, JSON.stringify(eventData, null, 2));

        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error('Error processing Excel file:', error);
        res.status(500).send('Error processing Excel file. Please try again.');
    }
});

// POST route to handle updating an event
app.post('/edit-event/:filename', upload.single('event-file'), (req, res) => {
    const filename = req.params.filename;
    const { 'event-name': eventName, 'event-date': eventDate, 'guest-list-data': guestListData } = req.body;

    let eventData;
    try {
        eventData = JSON.parse(fs.readFileSync(`data/${filename}.json`));
    } catch (error) {
        console.error(`Error reading or parsing file ${filename}.json:`, error);
        eventData = { name: '', date: '', guests: [] };
    }

    eventData.name = eventName;
    eventData.date = eventDate;
    eventData.guests = JSON.parse(guestListData);

    fs.writeFileSync(`data/${filename}.json`, JSON.stringify(eventData, null, 2));

    res.redirect('/admin-dashboard');
});

// Route to render hostess login
app.get('/hostess-login', (req, res) => {
    res.render('hostess-login');
});

// POST route to handle hostess login
app.post('/hostess-login', (req, res) => {
    const eventFilename = req.body.event;

    const eventDataPath = path.join(__dirname, 'data', `${eventFilename}.json`);
    if (!fs.existsSync(eventDataPath)) {
        return res.status(404).send('Event not found ' + eventDataPath);
    }

    const eventData = JSON.parse(fs.readFileSync(eventDataPath, 'utf8'));

    const isAuthenticated = true;

    if (isAuthenticated) {
        res.redirect(`/hostess-dashboard?event=${eventFilename}`);
    } else {
        res.status(403).send('Unauthorized');
    }
});

// Route to render the hostess dashboard
app.get('/hostess-dashboard', (req, res) => {
    const eventFilename = req.query.event;
    const eventFilePath = path.join(__dirname, 'data', `${eventFilename}.json`);

    fs.readFile(eventFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).send('Event not found ' + eventFilePath);
        }

        const eventData = JSON.parse(data);
        res.render('hostess-dashboard', { eventName: eventData.eventName, guests: eventData.guests });
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server is running on http://127.0.0.1:${PORT}`);
});
