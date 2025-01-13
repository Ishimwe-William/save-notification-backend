import express from "express";
import {initializeApp} from "firebase/app";
import {getDatabase, ref, onValue, get, set, off, push} from "firebase/database";
import dotenv from "dotenv";

dotenv.config();

const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: process.env.AUTH_DOMAIN,
    projectId: process.env.PROJECT_ID,
    storageBucket: process.env.STORAGE_BUCKET,
    messagingSenderId: process.env.MESSAGING_SENDER_ID,
    appId: process.env.APP_ID,
    databaseURL: process.env.DATABASE_URL,
    measurementId: process.env.MEASUREMENT_ID,
};

const app = express();
const firebaseApp = initializeApp(firebaseConfig);
const rtdb = getDatabase(firebaseApp);

const THRESHOLDS_PATH = '/warehouse/thresholds';
const GENERAL_NOTIFICATIONS_PATH = '/warehouse/notifications/general';
const WAREHOUSE_DATA_PATH = '/warehouse/data';

async function saveNotificationToFirebase(notification) {
    try {
        const notificationRef = ref(rtdb, GENERAL_NOTIFICATIONS_PATH);

        // Check for recent similar notifications
        const snapshot = await get(notificationRef);
        let shouldSaveNotification = true;

        if (snapshot.exists()) {
            const notifications = Object.values(snapshot.val());
            const recentNotification = notifications[notifications.length - 1];

            const isIdenticalNotification =
                recentNotification.type === notification.type &&
                recentNotification.message === notification.message &&
                recentNotification.value === notification.value &&
                recentNotification.dataTimestamp === notification.dataTimestamp;

            if (isIdenticalNotification) {
                console.log('Identical notification found, skipping:', notification);
                shouldSaveNotification = false;
            }
        }

        if (shouldSaveNotification) {
            const newNotificationKey = push(notificationRef).key;
            const finalNotificationRef = ref(rtdb, `${GENERAL_NOTIFICATIONS_PATH}/${newNotificationKey}`);

            await set(finalNotificationRef, {
                ...notification,
                readBy: {},
                timestamp: new Date().toISOString()
            });
            console.log('New notification saved:', notification);
        }
    } catch (error) {
        console.error("Error saving notification:", error);
    }
}

function checkThresholdBreach(value, highThreshold, lowThreshold) {
    if (value > highThreshold) {
        return 'high'; // Value is above the high threshold
    } else if (value < lowThreshold) {
        return 'low'; // Value is below the low threshold
    }
    return null; // Value is within the range, do nothing
}

function startMonitoring() {
    console.log('Starting warehouse monitoring service...');

    const warehouseDataRef = ref(rtdb, WAREHOUSE_DATA_PATH);
    const thresholdsRef = ref(rtdb, THRESHOLDS_PATH);

    // Clear existing listeners
    off(warehouseDataRef);
    off(thresholdsRef);

    // Track current thresholds and the last threshold update timestamp
    let currentThresholds = null;
    let lastThresholdUpdateTime = null;

    // Listen for threshold changes
    onValue(thresholdsRef, (snapshot) => {
        if (snapshot.exists()) {
            currentThresholds = snapshot.val();
            lastThresholdUpdateTime = new Date().toISOString(); // Update the threshold change timestamp
            console.log('Thresholds updated:', currentThresholds, 'at', lastThresholdUpdateTime);
        }
    });

    // Process warehouse data changes
    onValue(warehouseDataRef, async (snapshot) => {
        try {
            if (!snapshot.exists() || !currentThresholds) {
                return;
            }

            const data = snapshot.val();
            const entries = Object.entries(data)
                .sort((a, b) => new Date(b[0].replace("_", "T")) - new Date(a[0].replace("_", "T")));

            if (entries.length === 0) return;

            const [mostRecentKey, mostRecentData] = entries[0];

            // Skip processing if the data is older than the last threshold update
            if (lastThresholdUpdateTime && mostRecentData.createdAt_time <= lastThresholdUpdateTime) {
                console.log('Skipping old data point:', mostRecentData.createdAt_time);
                return;
            }

            console.log('Processing data point:', {
                time: mostRecentData.createdAt_time,
                temperature: mostRecentData.temperature,
                humidity: mostRecentData.humidity
            });

            // Check humidity thresholds
            const humidityBreach = checkThresholdBreach(
                mostRecentData.humidity,
                currentThresholds.humHighThreshold,
                currentThresholds.humLowThreshold
            );

            if (humidityBreach) {
                const message = humidityBreach === 'high'
                    ? `Humidity above maximum threshold of ${currentThresholds.humHighThreshold}% at ${mostRecentData.createdAt_time}`
                    : `Humidity below minimum threshold of ${currentThresholds.humLowThreshold}% at ${mostRecentData.createdAt_time}`;

                await saveNotificationToFirebase({
                    type: 'threshold_breach',
                    message,
                    value: mostRecentData.humidity,
                    dataTimestamp: mostRecentData.createdAt_time,
                    parameter: 'humidity',
                    breachType: humidityBreach
                });
            }

            // Check temperature thresholds
            const temperatureBreach = checkThresholdBreach(
                mostRecentData.temperature,
                currentThresholds.tempHighThreshold,
                currentThresholds.tempLowThreshold
            );

            if (temperatureBreach) {
                const message = temperatureBreach === 'high'
                    ? `Temperature above maximum threshold of ${currentThresholds.tempHighThreshold}°C at ${mostRecentData.createdAt_time}`
                    : `Temperature below minimum threshold of ${currentThresholds.tempLowThreshold}°C at ${mostRecentData.createdAt_time}`;

                await saveNotificationToFirebase({
                    type: 'threshold_breach',
                    message,
                    value: mostRecentData.temperature,
                    dataTimestamp: mostRecentData.createdAt_time,
                    parameter: 'temperature',
                    breachType: temperatureBreach
                });
            }

        } catch (error) {
            console.error('Error processing warehouse data:', error);
        }
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        uptime: process.uptime()
    });
});

// Start monitoring
startMonitoring();

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

export default app;
