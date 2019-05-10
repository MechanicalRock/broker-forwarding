export type MessagePayloadAndStatus = { message: any; success: boolean; };
export type QueueToS3Config = {
    mqHost: string;
    mqPort: number;
    queueName: string; 
    bucketName: string;
    maxPullMessages?: number;
    timeoutSafetyMarginPercent?: number;
    timeout?:number;
    idleTimeout?: number; 
};

export const DefaultQueueToS3Config = {
    maxPullMessages: 10,
    timeoutSafetyMarginPercent: 10,
    timeout: 180,
    idleTimeout: 5
} as QueueToS3Config;

export interface QueueToS3 {
    getConfig() : QueueToS3Config;
    getIncomingBuffer(): any[];
    initialise(s3: AWS.S3): void;
    copyToS3(messageEvents: any[]): Promise<MessagePayloadAndStatus[]>;
    hasCredit(): boolean;
    addCredit(credit: number): void;
    accept(messageEvent: any): void;
    release(messageEvent: any): void;
    tearDown(): void;
    secondsIdleIsGreaterThan(idleTimeSeconds: number): boolean;
    startLoop(): Promise<string>;
}
