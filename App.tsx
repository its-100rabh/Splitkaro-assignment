import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Button,
    FlatList,
    TextInput,
    Pressable,
    ActivityIndicator,
    PermissionsAndroid,
    StyleSheet,
    Modal,
} from 'react-native';
import SmsAndroid from 'react-native-get-sms-android';

interface SmsMessage {
    id: string;
    body: string;
    sender: string;
    amount: string;
    date: string;
    timeAgo: string;
    type: 'debited' | 'credited';
    category?: string; // Optional category based on message content
}

const App: React.FC = () => {
    const [messages, setMessages] = useState<SmsMessage[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [filter, setFilter] = useState<'all' | 'credited' | 'debited'>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
    const [modalVisible, setModalVisible] = useState<boolean>(false); // Modal visibility state

    useEffect(() => {
        requestSmsPermission().then(permission => {
            setPermissionGranted(permission);
            if (permission) fetchSmsMessages();
        });

        // Set an interval for polling new SMS messages every 5 seconds
        const interval = setInterval(() => {
            if (permissionGranted) fetchSmsMessages();
        }, 5000);
        setRefreshInterval(interval);

        // Cleanup interval on unmount
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [permissionGranted]);

    const requestSmsPermission = async (): Promise<boolean> => {
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS);
            setModalVisible(false); // Close the modal once permission is granted
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } catch (err) {
            console.warn('Permission error:', err);
            return false;
        }
    };

    const openPermissionModal = () => {
        setModalVisible(true);
    };

    const parseMessageDetails = (message: any): SmsMessage => {
        const amountMatch = message.body.match(/(?:INR|Rs\.?)\s?(\d+(?:,\d{3})*(?:\.\d+)?)/i);
        const amount = amountMatch ? amountMatch[1] : 'N/A';
        const type = message.body.toLowerCase().includes('debited') ? 'debited' : 'credited';
        const category = extractCategory(message.body);
        const timeAgo = calculateTimeAgo(message.date_sent);

        return {
            id: message._id,
            body: message.body,
            sender: message.address || 'Unknown',
            amount: amount,
            date: new Date(message.date_sent).toLocaleDateString(),
            timeAgo,
            type,
            category, // Include category
        };
    };

    const extractCategory = (messageBody: string): string | undefined => {
        if (messageBody.toLowerCase().includes('grocery')) return 'Grocery';
        if (messageBody.toLowerCase().includes('dining')) return 'Dining';
        if (messageBody.toLowerCase().includes('shopping')) return 'Shopping';
        return undefined; // Default to undefined if no category matches
    };

    const calculateTimeAgo = (dateSent: number) => {
        const diffInMinutes = Math.floor((Date.now() - dateSent) / (1000 * 60));
        if (diffInMinutes < 60) return `${diffInMinutes} minute(s) ago`;
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hour(s) ago`;
        return `${Math.floor(diffInHours / 24)} day(s) ago`;
    };

    const fetchSmsMessages = () => {
        setLoading(true);
        const filter = { box: 'inbox', maxCount: 1000 };

        SmsAndroid.list(
            JSON.stringify(filter),
            (fail: any) => {
                console.error('Failed to read SMS:', fail);
                setLoading(false);
            },
            (count: any, smsList: string) => {
                const parsedMessages = JSON.parse(smsList)
                    .filter((msg: any) => msg.body.includes('debited') || msg.body.includes('credited'))
                    .map(parseMessageDetails);

                setMessages(parsedMessages);
                setLoading(false);
            }
        );
    };

    const filteredMessages = messages
        .filter(msg => (filter === 'all' ? true : msg.type === filter))
        .filter(msg => {
            const query = searchQuery.toLowerCase();
            return msg.body.toLowerCase().includes(query) || msg.sender.toLowerCase().includes(query);
        });

    return (
        <View style={styles.container}>
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={openPermissionModal}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>SMS Permission Required</Text>
                        <Text style={styles.modalMessage}>This app requires SMS permission to function correctly. Please grant access.</Text>
                        <Button title="Grant Permission" onPress={requestSmsPermission} />
                        <Button title="Cancel" onPress={() => setModalVisible(false)} />
                    </View>
                </View>
            </Modal>

            <View style={styles.header}>
                <Text style={styles.title}>Expense Messages</Text>
                <TextInput
                    style={styles.search}
                    placeholder="Search by sender or amount"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                <View style={styles.filterContainer}>
                    {['all', 'credited', 'debited'].map(f => (
                        <Pressable
                            key={f}
                            style={filter === f ? styles.activeButton : styles.button}
                            onPress={() => setFilter(f as 'all' | 'credited' | 'debited')}
                        >
                            <Text style={filter === f ? styles.activeText : styles.buttonText}>{f}</Text>
                        </Pressable>
                    ))}
                </View>
                <Button title="View All Expenses" onPress={fetchSmsMessages} />
            </View>
            {loading ? (
                <ActivityIndicator size="large" color="#6200EE" style={styles.loading} />
            ) : permissionGranted === false ? (
                <Text style={styles.permissionText}>SMS permission denied. Enable in settings.</Text>
            ) : (
                <FlatList
                    data={filteredMessages}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.messageCard}>
                            <Text style={styles.sender}>{item.sender}</Text>
                            <Text style={styles.amount}>Amount: {item.amount}</Text>
                            <Text style={styles.date}>Date: {item.date} ({item.timeAgo})</Text>
                            <Text style={styles.body}>Description: {item.body}</Text>
                            {item.category && <Text style={styles.category}>Category: {item.category}</Text>}
                        </View>
                    )}
                />
            )}
            <Button title="Refresh Messages" onPress={fetchSmsMessages} />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: 'white' },
    header: { marginBottom: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
    search: { backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 10 },
    filterContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    button: { padding: 10, borderRadius: 8, backgroundColor: '#e0e0e0', marginHorizontal: 5 },
    activeButton: { padding: 10, borderRadius: 8, backgroundColor: '#6200EE', marginHorizontal: 5 },
    buttonText: { color: 'black', fontWeight: '500' },
    activeText: { color: 'white', fontWeight: 'bold' },
    loading: { marginTop: 20 },
    permissionText: { textAlign: 'center', color: 'red', marginVertical: 20 },
    messageCard: { backgroundColor: '#f8f8f8', padding: 15, borderRadius: 8, marginVertical: 5 },
    sender: { fontWeight: 'bold', marginBottom: 5 },
    amount: { color: 'green' },
    date: { fontSize: 12, color: 'gray' },
    body: { marginTop: 5 },
    category: { marginTop: 5, fontStyle: 'italic', color: 'blue' },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    modalMessage: { marginBottom: 20, textAlign: 'center' },
});

export default App;
