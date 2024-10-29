declare module 'react-native-get-sms-android' {
    export interface Sms {
        _id: number;
        address: string;
        body: string;
        date: string;
    }
    interface SmsFilter {
        box: 'inbox' | 'sent' | 'draft';
        minDate?: number;
        maxDate?: number;
        indexFrom?: number;
        maxCount?: number;
    }
    const SmsAndroid: {
        list(
            filter: string,
            failureCallback: (error: string) => void,
            successCallback: (count: number, smsList: string) => void
        ): void;
    };
    export default SmsAndroid;
}
