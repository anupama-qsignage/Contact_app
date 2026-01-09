declare module 'react-native-call-log' {
  interface CallLogEntry {
    phoneNumber: string;
    dateTime: number;
    duration: number;
    type: string;
    name?: string;
    cachedNumberType?: number;
    cachedNumberLabel?: string;
    cachedMatchedNumber?: string;
    cachedNormalizedNumber?: string;
    cachedPhotoUri?: string;
    cachedFormattedNumber?: string;
  }

  interface CallLog {
    load(limit: number): Promise<CallLogEntry[]>;
  }

  const CallLogs: CallLog;
  export default CallLogs;
}

