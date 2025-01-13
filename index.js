import { listenToThresholds } from './src/server.js';
const express = require('express');
const app = express();
const PORT = 4000;

// Simple test function to check if the server is working
const testServer = async () => {
    console.log('Starting the server...');

    // Test listening to thresholds
    try {
        listenToThresholds();
    } catch (error) {
        console.error('Error in server:', error);
    }
};

testServer();

app.get('/home', (req, res) => {
    res.status(200).json('Welcome, your app is working well');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = app;

