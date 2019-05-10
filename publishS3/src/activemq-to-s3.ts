import * as Rhea from 'rhea';
import { S3 } from 'aws-sdk';
import { QueueToS3Config, QueueToS3, DefaultQueueToS3Config, MessagePayloadAndStatus } from './queue-to-s3';
import { GeneralHelper } from './utils';

export const EXIT_NEAR_TIMEOUT = "Approaching Lambda Timeout";
export const EXIT_IDLE_NO_MESSAGES = "No new messages after idle period";
export const EXIT_INFINITE_LOOP = "Suspected infinite loop";
export const EXIT_S3_COPY_FAILURE = "Aborting due to S3 copy failure";

export class ActiveMqToS3 implements QueueToS3 {
    private config: QueueToS3Config;
    private incoming: any[];

    private connection: Rhea.Connection|undefined;
    private queue: Rhea.Receiver|undefined;
    private s3: S3|undefined;
    private lastUpdated: Date;
    private util: GeneralHelper;
    

    constructor(conf: QueueToS3Config, util: GeneralHelper, incoming: any[] = []) {
        this.config = {...DefaultQueueToS3Config, ...conf};
        this.util = util;
        this.incoming = incoming;
        this.lastUpdated = new Date();
    }

    getConfig(): QueueToS3Config {
        return this.config;
    }

    getIncomingBuffer(): any[] {
        return this.incoming;
    }

    initialise(s3: S3):void {
        // connect
        this.connection = Rhea.connect({host: this.config.mqHost, port: this.config.mqPort});
        // register callback
        this.connection.on('message', (event: Rhea.EventContext) => {
            this.incoming.push(event);
            this.lastUpdated = new Date();
        });
        this.queue = this.connection.open_receiver({ credit_window: 0, autoaccept: false, source: this.config.queueName});
        this.s3 = s3;
    }

    tearDown(): void {
        if ( this.queue && this.queue.is_open() ) {
            this.queue.close();
        }

        if ( this.connection && this.connection.is_open() ) {
            this.connection.close();
        }
    }

   

    async copyToS3(messageEvents: Rhea.EventContext[]): Promise<MessagePayloadAndStatus[]> {
        if ( messageEvents === undefined || messageEvents.length === 0 ) {
            return [];
        }

        let payloads: MessagePayloadAndStatus[] = [];

        for ( let i = 0; i < messageEvents.length; i++) {
            let event = messageEvents[i];
            let success = true;
            try {
                 await this.s3!.putObject({  
                    Bucket: this.config.bucketName,
                    Key: this.util.createKeyName(this.config.queueName),
                    Body: JSON.stringify(event.message!.body.toString())
                }).promise();
            } catch (e) {
                success = false;
                console.log(e);
            }
            payloads.push( { success: success, message: event});
        }    
        return payloads;
    }    

    accept(messageEvent: Rhea.EventContext): void {
        if ( messageEvent && messageEvent.delivery ) {
            messageEvent.delivery.accept()
        }
    }

    release(messageEvent: Rhea.EventContext): void {
        if ( messageEvent && messageEvent.delivery ) {
            messageEvent.delivery.release();
        }
    }

    hasCredit(): boolean {
        return this.queue !== undefined && this.queue.has_credit();
    }

    addCredit(credit: number): void {
        if ( this.queue !== undefined ) {
            this.queue.add_credit(credit);
        } else {
            throw new Error('Cannot add credit to queue in this state');
        }
    }

    secondsIdleIsGreaterThan(idleTimeSeconds: number): boolean {
        return new Date().getTime() > (this.lastUpdated.getTime() + idleTimeSeconds);
    }

    async startLoop(): Promise<string>  {
        let exitCode = EXIT_INFINITE_LOOP;
        let startTime = new Date();
        let config = this.getConfig(); 
        let incoming = this.getIncomingBuffer();
    
        let outgoing: any[] = [];
        const idleSleepMs = 50;
        let maxLoops = (config.timeout * 1000) / idleSleepMs;
        // start a processing loop
        out:
        while ( maxLoops-- > 0 ) {
            if ( this.util.nearTimeout(startTime, config.timeout, config.timeoutSafetyMarginPercent) ) {
                exitCode = EXIT_NEAR_TIMEOUT;
                break;
            } else if ( this.secondsIdleIsGreaterThan( config.idleTimeout ) ){
                exitCode = EXIT_IDLE_NO_MESSAGES;
                break;
            }
            if ( incoming.length != outgoing.length ) {
                let results = await this.copyToS3( this.util.theDeltaOf( incoming, outgoing));
                for ( let i = 0; i < results.length; i++) {
                    let res = results[i];
                    if ( res.success ) {
                        this.accept(res.message);
                        outgoing.push( res )
                    } else {
                        this.release( res.message );
                        exitCode = EXIT_S3_COPY_FAILURE;
                        break out;
                    }
                }
            } else if ( ! this.hasCredit() ) {
                this.addCredit(config.maxPullMessages);
            }
            await this.util.sleep(idleSleepMs);
        }
        return exitCode;
    }
    
}