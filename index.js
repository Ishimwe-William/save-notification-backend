import { listenToThresholds } from './src/server.js';
import express from "express";

const app = express();

// Start listening to thresholds when the function is loaded
listenToThresholds();

// Define your routes
app.get('/home', (req, res) => {
    res.status(200).json('Welcome, your app is working well');
});

// Export the app as a serverless function
export default app;
