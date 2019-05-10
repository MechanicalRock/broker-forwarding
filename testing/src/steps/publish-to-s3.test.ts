import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('features/publish-to-s3.feature');

// hosts correspond to service names within docker-compose.yml
import Rhea from 'rhea';
import { S3 } from 'aws-sdk';

const settings = {
    s3Endpoint : 'http://s3:4572',
    mqHost: 'activemq',
    mqPort: 5672,
    queueTimeout: 3 // wait only for 3 seconds
}
const s3 = new S3({endpoint: settings.s3Endpoint, sslEnabled: false, s3ForcePathStyle: true,
                             credentials: {accessKeyId: '1', secretAccessKey: '2' }} as S3.ClientConfiguration);
const bucketName = new Date().getTime().toString(16) + Math.random();

defineFeature(feature, scenario  => {
    beforeAll( async () => {
        let result = await s3.createBucket( { Bucket: bucketName }).promise();
    });

    afterAll( async () => {
        let result = await s3.listObjectsV2({Bucket: bucketName}).promise();
        await s3.deleteObjects({
            Bucket: bucketName,
            Delete: { 
                Objects: result.Contents!.map( o => { 
                    return { Key : o.Key};
                }) as Array<any>
            }
        }).promise();
        await s3.deleteBucket({Bucket: bucketName}).promise();
    });

    scenario('All queue messages are published to S3', ({ given, when, then, and }) => {
        const queueName = new Date().getTime().toString(16) + Math.random();
        let answer = 0;
        let messageCount = 0;
        const drainCount = 3;
        given('the wiretap queue has messages to be consumed', async () => {
            const messagesToBeWritten = 7;
            await postMessages(queueName, messagesToBeWritten);
        });
        
        when('the lambda publisher is run', async () => {
            const cq = {} as ConnectionAndQueue;
            let messages = await lambdaDrainQueue(cq, queueName, drainCount);
            messageCount = messages.length;
            for ( let i = 0; i < messageCount; i++) {
                let message = messages[i].message;
                answer += parseInt( message!.body.toString() );
                await lambdaPublishToS3(queueName, message!.body);
            }
            cq.queue.close();
            cq.connection.close();
        });
        
        let s3Answer = 0;
        then('log files should be published to S3 under the date and queue separated path', async () => {
            expect(messageCount).toBe(drainCount);
            let results = await s3.listObjectsV2({Bucket: bucketName}).promise();
            expect(results.KeyCount).toBe(messageCount);
            
            expect(results.Contents).toBeDefined();
            let promises:any[] = await Promise.all( await results.Contents!.map( async (o) => {
                expect( keyMatchesNameFormat(o.Key!) ).toBe(true);
                let result = await s3.getObject({Bucket: bucketName, Key: o.Key} as AWS.S3.GetObjectRequest).promise();
                return parseInt( result.Body!.toString() );
            }));
            
            s3Answer = promises.reduce(  (p, c) => {
                return p + c;
            }, 0);
            expect(results.Contents!.length).toBe(messageCount);
        });
        
        and('they should contain the queue messages', () => {
            expect(s3Answer).toEqual(answer);
        });
    });

    scenario('We only acknowledge messages that have been written to S3', ({ given, and, when, then }) => {
        const queueName = new Date().getTime().toString(16) + Math.random();
        const messagesToBeWritten = 5;
        let events: Rhea.EventContext[];
        const cq = {} as ConnectionAndQueue;
            
        given('the wiretap queue has messages to be consumed', async () => {
            await postMessages(queueName, messagesToBeWritten);
        });
        
        and('a message has been drawn from the queue', async() => {
            events = await lambdaDrainQueue(cq, queueName, 1);
        });
        
        when('we write the message to S3 and it throws an exception', async () => {
            events.forEach( event => {
                try {
                    // lambdaPublishToS3(queueName, event.message!.body);
                    throw new Error('l');
                    event.delivery!.accept();
                } catch (e) {
                    event.delivery!.release();
                }                
            });
            await sleep(1000);
            cq.queue.close();
            cq.connection.close();
        });
        
        then('the message should not be acknowledged', async () => {
            // should be able to re-request all of the events
            events = await lambdaDrainQueue(cq, queueName, messagesToBeWritten);
            events.forEach( e => e.delivery!.accept());
            expect(events.length).toEqual(messagesToBeWritten);
            cq.queue.close();
            cq.connection.close();
        });
    });
        
        
});

async function postMessages(qn: string, count: number) {
    Rhea.options.username = 'anonymous';
    let connection = await Rhea.connect({host: settings.mqHost, port: settings.mqPort, } as Rhea.ConnectionOptions);
    let sender = await connection.attach_sender(qn);
    connection.on('sendable', (context: Rhea.EventContext) => {
        for (let i = 1; i <= count; i++) {
            context.sender!.send( { message_id: i, body: i} as Rhea.Message);
        }    
    });
    await sleep(1000);
    await sender.close();
    connection.close();
}


async function lambdaDrainQueue(cq: ConnectionAndQueue, qn: string, count:number = 1) : Promise<Rhea.EventContext[]> {
    let events: Rhea.EventContext[] = [];
    Rhea.options.username = 'anonymous';
    cq.connection = await Rhea.connect({host: settings.mqHost, port: settings.mqPort,  } as Rhea.ConnectionOptions);
    cq.connection.on('message', (event: Rhea.EventContext) => {
        events.push(event);
    });
    cq.queue = await cq.connection.open_receiver( {credit_window: 0, source: qn, autoaccept: false} as Rhea.ReceiverOptions);
    cq.queue.add_credit(count);
    await new Promise( (resolve) => setTimeout(resolve, 1000));
    return events;
}

async function lambdaPublishToS3(qn: string, mqMessage: string) {
    let filename = '';
    const date = new Date()
    const year = date.getFullYear()
    const month = appendLeadingZeros(date.getMonth() + 1)
    const day = appendLeadingZeros(date.getDate())
    const hours = appendLeadingZeros(date.getHours())
    const minutes = appendLeadingZeros(date.getMinutes())
    const seconds = appendLeadingZeros(date.getSeconds())
    const millis = appendLeadingZeros(date.getMilliseconds(),2);

    await s3.putObject({  Bucket: bucketName as string,
        Key: `${year}/${month}/${day}/${qn}_${hours}:${minutes}:${seconds}.${millis}`,
        Body: JSON.stringify(mqMessage)
    }).promise();
}

const appendLeadingZeros = (n: number, order: number = 1) => {
    return n.toString().padStart(order,'0');
}

const keyMatchesNameFormat = (key: string): boolean => {
    const pattern = /\d{4}\/\d{2}\/\d{2}\/\w+_\d{2}:\d{2}:\d{2}\.\d{3}/;
    return pattern.compile().test(key);
}

interface MqMessage {
    body: string;
}
const sleep = async(millis: number) => new Promise((resolve) => setTimeout(resolve, millis));

interface ConnectionAndQueue {
    connection: Rhea.Connection;
    queue: Rhea.Receiver;
    
}