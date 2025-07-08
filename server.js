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
const session = require('express-session'); 
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

// Session middleware - add this right here, after other middleware setup
app.use(session({
    secret: 'edelweiss-wedding-planner-secret', // Change this to a secure random string
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Add this middleware before your routes
app.use((req, res, next) => {
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
});

// Add this middleware function after your session configuration
const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        next();
    } else {
        res.redirect('/');
    }
};

// Serve client-side socket.io script
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(path.join(__dirname, '/node_modules/socket.io/client-dist/socket.io.js'));
});

app.get('/check-auth', (req, res) => {
    console.log('Check auth request received');
    console.log('Session:', req.session);
    console.log('Is authenticated:', req.session && req.session.isAuthenticated);
    
    res.json({
        authenticated: !!(req.session && req.session.isAuthenticated)
    });
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

// Route to render login page or redirect if already logged in
app.get('/', (req, res) => {
    console.log('Root route accessed');
    console.log('Session:', req.session);
    console.log('Is authenticated:', req.session && req.session.isAuthenticated);
    
    // Check if user is already logged in
    if (req.session && req.session.isAuthenticated) {
        console.log('User is authenticated, redirecting to dashboard');
        return res.redirect('/admin-dashboard');
    }
    
    // User is not logged in, show the login page
    console.log('User is not authenticated, showing login page');
    res.render('login', { error: null });
});

// Route to handle login form submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'admin' && password === 'admin') {
        // Set authentication in session
        req.session.isAuthenticated = true;
        req.session.username = username;
        
        res.redirect('/admin-dashboard');
    } else {
        res.render('login', { error: 'Invalid username or password' });
    }
});

// Route to render admin dashboard
app.get('/admin-dashboard', requireAuth, (req, res) => {
    const currentDate = new Date().toISOString().slice(0, 10);
    fs.readdir(dataFolder, (err, files) => {
        if (err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
            return;
        }

        const events = files
            .filter(file => file.endsWith('.json'))  // Only process JSON files
            .map(file => {
                const fileName = file.replace('.json', '');
                const eventFilePath = path.join(dataFolder, file);
                try {
                    const eventData = JSON.parse(fs.readFileSync(eventFilePath, 'utf8'));
                    return {
                        fileName,
                        eventName: eventData.eventName,
                        eventDate: eventData.eventDate,
                        eventLocation: eventData.eventLocation,
                        eventPrice: eventData.eventPrice,
                        eventStatus: eventData.eventStatus,
                        guestCount: eventData.guests ? eventData.guests.length : 0
                    };
                } catch (error) {
                    console.error(`Error reading file ${file}:`, error);
                    return null;
                }
            })
            .filter(Boolean);  // Remove any null values from errors

        // Pass the deleted parameter to the template
        res.render('admin-dashboard', { 
            events, 
            currentDate, 
            deleted: req.query.deleted === 'true'  // Pass the deleted flag
        });
    });
});

// Logout route
app.get('/logout', (req, res) => {
    // If you're using express-session for session management
    if (req.session) {
        // Destroy the session
        req.session.destroy(err => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).send('Error logging out');
            }
            
            // Clear the session cookie
            res.clearCookie('connect.sid');
            
            // Redirect to login page
            res.redirect('/');
        });
    } else {
        // If not using express-session, just redirect to login
        res.redirect('/');
    }
});

// Route to handle event deletion
app.post('/delete-event/:filename', requireAuth, (req, res) => {
    const filename = req.params.filename;
    const eventFilePath = path.join(dataFolder, `${filename}.json`);
    
    try {
        // Check if file exists
        if (fs.existsSync(eventFilePath)) {
            // Delete the file
            fs.unlinkSync(eventFilePath);
            console.log(`Successfully deleted event: ${filename}`);
            
            // Redirect back to dashboard with success message
            res.redirect('/admin-dashboard?deleted=true');
        } else {
            console.error(`Event file not found: ${filename}`);
            res.status(404).send('Event not found');
        }
    } catch (error) {
        console.error(`Error deleting event ${filename}:`, error);
        res.status(500).send(`Error deleting event: ${error.message}`);
    }
});

// Route to render edit event page
app.get('/edit-event/:filename', requireAuth, (req, res) => {
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
app.post('/create-event', requireAuth, upload.single('eventFile'), (req, res) => {
    const { 
        eventName, 
        eventDate, 
        jsonFilename,
        eventLocation,
        eventPrice,
        eventStatus
    } = req.body;

    console.log('Create event request body:', req.body);
    console.log('File received:', req.file ? req.file.originalname : 'No file');

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
            eventLocation: eventLocation || '',
            eventPrice: eventPrice || '',
            eventStatus: eventStatus || 'in asteptare',
            guests: guests
        };

        console.log('Creating event:', eventData);
        
        const targetJsonFilePath = path.join(dataFolder, `${jsonFilename}.json`);
        fs.writeFileSync(targetJsonFilePath, JSON.stringify(eventData, null, 2));

        res.redirect('/admin-dashboard');
    } catch (error) {
        console.error('Error processing Excel file:', error);
        res.status(500).send('Error processing Excel file. Please try again.');
    }
});

// POST route to handle updating an event
app.post('/edit-event/:filename', requireAuth, upload.single('event-file'), (req, res) => {
    const filename = req.params.filename;
    const { 
        'event-name': eventName, 
        'event-date': eventDate, 
        'event-location': eventLocation,
        'event-price': eventPrice,
        'event-status': eventStatus,
        'guest-list-data': guestListData 
    } = req.body;

    let eventData;
    try {
        eventData = JSON.parse(fs.readFileSync(`data/${filename}.json`));
    } catch (error) {
        console.error(`Error reading or parsing file ${filename}.json:`, error);
        eventData = { 
            eventName: '', 
            eventDate: '', 
            eventLocation: '',
            eventPrice: '',
            eventStatus: '',
            guests: [] 
        };
    }

    // Update the event data
    eventData.eventName = eventName;
    eventData.eventDate = eventDate;
    eventData.eventLocation = eventLocation;
    eventData.eventPrice = eventPrice;
    eventData.eventStatus = eventStatus;
    eventData.guests = JSON.parse(guestListData);

        
    if (guestListData) {
        eventData.guests = JSON.parse(guestListData);
    }

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
