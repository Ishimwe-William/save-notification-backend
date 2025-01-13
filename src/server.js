import { ref, get, set, push, onValue, query, orderByChild, equalTo, limitToLast } from "firebase/database";
import {rtdb} from "./firebaseConfig.js";

const THRESHOLDS_PATH = '/warehouse/thresholds';
const GENERAL_NOTIFICATIONS_PATH = '/warehouse/notifications/general';

export const listenToThresholds = () => {
    const thresholdsRef = ref(rtdb, THRESHOLDS_PATH);

    // Use onValue() to listen to value changes in Realtime Database
    onValue(thresholdsRef, async (snapshot) => {
        try {
            const thresholds = snapshot.val();

            if (thresholds) {
                const mostRecentData = await fetchMostRecentWarehouseData();

                if (mostRecentData) {
                    console.log('Checking the most recent data:', mostRecentData);

                    for (const [key, thresholdValue] of Object.entries(thresholds)) {
                        let value;
                        let message = '';

                        if (key.includes('hum')) {
                            value = mostRecentData.humidity;
                            message = `Humidity threshold of ${thresholdValue} breached for data point at ${mostRecentData.createdAt_time}`;
                        } else if (key.includes('temp')) {
                            value = mostRecentData.temperature;
                            message = `Temperature threshold of ${thresholdValue} breached for data point at ${mostRecentData.createdAt_time}`;
                        }

                        // Check if notification already exists
                        const existingNotification = await checkForExistingNotification(message, value);

                        if (!existingNotification) {
                            const notification = {
                                message,
                                value,
                                timestamp: new Date().toISOString(),
                                type: 'threshold_breach',
                            };
                            await saveNotification(notification);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error listening to thresholds:', error);
        }
    });
};

// Function to fetch the most recent warehouse data
const fetchMostRecentWarehouseData = async () => {
    try {
        const warehouseDataRef = ref(rtdb, '/warehouse/data');
        const snapshot = await get(warehouseDataRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            const latestKey = Object.keys(data).sort().reverse()[0];  // Get the latest entry based on key (assuming key is timestamp-based)
            return data[latestKey];
        } else {
            console.log('No warehouse data available');
            return null;
        }
    } catch (error) {
        console.error('Error fetching warehouse data:', error);
        return null;
    }
};

// Function to check if the notification already exists in the database
const checkForExistingNotification = async (message, value) => {
    try {
        const notificationRef = ref(rtdb, GENERAL_NOTIFICATIONS_PATH);
        const queryRef = query(
            notificationRef,
            orderByChild('message'),
            equalTo(message),
            limitToLast(1)
        );

        const snapshot = await get(queryRef);
        if (snapshot.exists()) {
            const existingNotification = Object.values(snapshot.val())[0];
            if (existingNotification.message === message && existingNotification.value === value) {
                console.log('Notification already exists:', existingNotification);
                return true;  // Notification already exists
            }
        }
        return false;  // No duplicate found
    } catch (error) {
        console.error('Error checking for existing notification:', error);
        return false;
    }
};

// Function to save a notification to Firebase
const saveNotification = async (notification) => {
    try {
        const notificationsRef = ref(rtdb, GENERAL_NOTIFICATIONS_PATH);
        const newNotificationKey = push(notificationsRef).key;

        await set(ref(rtdb, `${GENERAL_NOTIFICATIONS_PATH}/${newNotificationKey}`), notification);
        console.log('Notification saved:', notification);
    } catch (error) {
        console.error('Error saving notification:', error);
    }
};
