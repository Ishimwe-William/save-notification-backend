import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const {
    API_KEY,
    AUTH_DOMAIN,
    PROJECT_ID,
    STORAGE_BUCKET,
    MESSAGING_SENDER_ID,
    DATABASE_URL,
    MEASUREMENT_ID,
    APP_ID,
} = process.env;

console.log(DATABASE_URL);
const firebaseConfig = {
    apiKey: API_KEY,
    authDomain: AUTH_DOMAIN,
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    messagingSenderId: MESSAGING_SENDER_ID,
    appId: APP_ID,
    databaseURL: DATABASE_URL, // Ensure the correct key name
    measurementId: MEASUREMENT_ID,
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
const rtdb = getDatabase(app);

export { app, rtdb };
