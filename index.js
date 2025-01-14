import express from "express";
import {initializeApp} from "firebase/app";
import {getDatabase, ref, onValue, set, push} from "firebase/database";
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

const sentNotifications = new Set(); // Set to store unique notification identifiers

async function saveNotificationToFirebase(notification) {
    try {
        const notificationRef = ref(rtdb, GENERAL_NOTIFICATIONS_PATH);

        // Generate a unique identifier based on notification data
        const notificationId = `${notification.type}_${notification.parameter}_${notification.breachType}_${notification.dataTimestamp}`;

        // Check if this notification has already been sent
        if (sentNotifications.has(notificationId)) {
            console.log('Identical notification found, skipping:', notification);
            return; // Skip saving if already sent
        }

        // Save the notification
        const newNotificationKey = push(notificationRef).key;
        const finalNotificationRef = ref(rtdb, `${GENERAL_NOTIFICATIONS_PATH}/${newNotificationKey}`);

        await set(finalNotificationRef, {
            ...notification,
            readBy: {},
            timestamp: new Date().toISOString()
        });

        // Add the notification identifier to the set of sent notifications
        sentNotifications.add(notificationId);
        console.log('New notification saved:', notification);

    } catch (error) {
        console.error("Error saving notification:", error);
    }
}

function checkThresholdBreach(value, highThreshold, lowThreshold) {
    if (value > highThreshold) {
        return 'high';
    } else if (value < lowThreshold) {
        return 'low';
    }
    return null; // value is within range
}

function startMonitoring() {
    console.log('Starting warehouse monitoring service...');

    const warehouseDataRef = ref(rtdb, WAREHOUSE_DATA_PATH);
    const thresholdsRef = ref(rtdb, THRESHOLDS_PATH);

    // Track current thresholds
    let currentThresholds = null;

    // Listen for threshold changes
    onValue(thresholdsRef, (snapshot) => {
        if (snapshot.exists()) {
            currentThresholds = snapshot.val();
            console.log('Thresholds updated:', currentThresholds);
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

            // Only process the most recent entry
            const [mostRecentData] = entries[0];

            console.log('Processing most recent data point:', {
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
