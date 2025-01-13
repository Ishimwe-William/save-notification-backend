import { listenToThresholds } from './src/server.js';
import express from 'express';

const app = express();
const PORT = 4000;

// Initialize the server and listen to Firebase
const initializeServer = async () => {
    console.log('Initializing the server...');
    try {
        // Start listening to thresholds in Firebase
        listenToThresholds();
        console.log('Listening to Firebase thresholds...');
    } catch (error) {
        console.error('Error initializing Firebase listener:', error.message);
    }
};

// Express route to test server functionality
app.get('/home', (req, res) => {
    res.status(200).json({ message: 'Welcome, your app is working well!' });
});

// Error-handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'An unexpected error occurred.' });
});

// Start the Express server
app.listen(PORT, async () => {
    console.log(`Server running at http://localhost:${PORT}`);
    await initializeServer(); // Call the Firebase initialization
});

export default app;
