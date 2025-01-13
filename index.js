import { listenToThresholds } from './src/server.js';

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
