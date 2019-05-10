import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('features/transparent-forwarding.feature');

// hosts correspond to service names within docker-compose.yml
const sourceBrokerHost = 'rabbitmq';
const destBrokerHost = 'activemq';
import * as Amqp from 'amqp-ts';
import { Buffer } from 'buffer';
import { StringDecoder } from 'string_decoder';
import { Message } from 'amqp-ts';
import Rhea from 'rhea';

defineFeature(feature, scenario  => {
    scenario('Publishing messages to source results in messages received on source consumer queue', ({ given, when, then }) => {
        const queuePattern = process.env['EXCHANGE_PATTERN_1'] || 'scenario1';
        let publishQueue = '';
        let connection = new Amqp.Connection( `amqp://${sourceBrokerHost}` );

    	given('message forwarding is activated', () => {
            publishQueue = initialiseForwarding(queuePattern);
    	});
        
    	when(/^I publish (.*) messages to the source broker exchange$/, async (count: string) => {
            publishToQueue(connection, publishQueue, count);
    	});

    	then(/^my source broker consumer queue should receive (.*) messages$/, async (count: string) => {
            let messageCount = 0;
            try {
                let queue = connection.declareQueue(`q.${queuePattern}`);
                try {
                    let result = queue.activateConsumer( (data: Message) => { 
                        data.ack();
                        messageCount++;
                    });
                } catch (f) { }
                await new Promise( (resolve: any) => setTimeout(resolve, 2000));
                await queue.stopConsumer();
                await queue.close();
                await connection.close();
            } catch (e) {
                console.log(e);
            }            
            expect(messageCount).toBe( parseInt(count) );            
    	});
    });

    scenario('Publishing messages to source results in messages received on destination consumer queue', ({ given, when, then }) => {
        Rhea.options.username = 'anonymous';
        const queuePattern = process.env['EXCHANGE_PATTERN_2'] || 'scenario2';
        let publishQueue = '';
        let sourceConnection: Amqp.Connection;
        try {
            sourceConnection = new Amqp.Connection( `amqp://${sourceBrokerHost}` );
        } catch (e) {
            console.log(e);
        }

        given('message forwarding is activated', () => {
            publishQueue = initialiseForwarding(queuePattern);
    	});

    	when(/^I publish (.*) messages to the source broker exchange$/, async (count) => {
            await publishToQueue(sourceConnection, publishQueue, count);
            await new Promise( (resolve: any) => setTimeout(resolve, 2000));
            await sourceConnection.close();
    	});

    	then(/^my destination broker consumer queue should receive (.*) messages$/, async (count) => {
            let messageCount = 0;
            try {
                // enable sasl even if no authentication is used. activemq default wire options require it
                let destConnection = await Rhea.connect({host: destBrokerHost, port: 5672,} as Rhea.ConnectionOptions);
                let queue = destConnection.open_receiver(publishQueue);
                try {
                    let result = queue.on('message', (data: any) => { 
                        messageCount++;
                    });
                } catch (f) { }
                await new Promise( (resolve: any) => setTimeout(resolve, 1000));
                await queue.close();
                await destConnection.close();
                await new Promise( (resolve: any) => setTimeout(resolve, 1000));
            } catch (e) {
                console.log(e);
            }            
            expect(messageCount).toBe( parseInt(count) );       
    	});
    });

    scenario('Publishing messages to source results in messages received on destination mirror queue', ({ given, and, when, then }) => {
        Rhea.options.username = 'anonymous';
        const queuePattern = process.env['EXCHANGE_PATTERN_3'] || 'scenario3';
        let publishQueue = '';
        let destConnection: any;
        let queue: any;
        let messageCount = 0;
       
        given('message forwarding is activated', () => {
            publishQueue = initialiseForwarding(queuePattern);            
    	});

    	and('I have subscribed to destination broker mirror queue', async () => {
            try {
                destConnection = await Rhea.connect({host: destBrokerHost, port: 5672,} as Rhea.ConnectionOptions);
                let mirrorQueue = `topic://VirtualTopic.${publishQueue}.wiretap`;
                queue = destConnection.open_receiver(mirrorQueue,);
                let result = queue.on('message', (data: any) => { 
                    messageCount++;
                });    
            } catch(e) {
                console.log(e);
            }
    	});

    	when(/^I publish (.*) messages to the source broker exchange$/, async (count) => {
            try {
                let sourceConnection: Amqp.Connection;sourceConnection = new Amqp.Connection( `amqp://${sourceBrokerHost}` );
                await publishToQueue(sourceConnection, publishQueue, count);
                await new Promise( (resolve: any) => setTimeout(resolve, 2000));
                await sourceConnection.close();
            } catch (e) {
                console.log(e);
            }
    	});

    	then(/^my subscription should receive (.*) messages$/, async (count) => {
            await new Promise( (resolve: any) => setTimeout(resolve, 2000));
            await queue.close();
            await destConnection.close();
            expect(messageCount).toBe( parseInt(count) );       
    	});
    });


    scenario('Mirror queues are durable once created', ({ given, and, when, then }) => {
        Rhea.options.username = 'anonymous';
        const queuePattern = process.env['EXCHANGE_PATTERN_4'] || 'scenario4';
        let publishQueue = '';
        let destConnection: any;
        let queue: any;
        let messageCount = 0;
        given('message forwarding is activated', () => {
            publishQueue = initialiseForwarding(queuePattern);            
    	});
        
        and('I create a durable subscription to destination broker mirror queue',async () => {
            try {
                destConnection = await Rhea.connect({host: destBrokerHost, port: 5672} as Rhea.ConnectionOptions);
                let mirrorQueue = `Consumer.jest.VirtualTopic.${publishQueue}.wiretap`;
                queue = await destConnection.open_receiver(mirrorQueue);
                await new Promise( (resolve: any) => setTimeout(resolve, 500));            
            } catch(e) {
                console.log(e);
            }        
        });
        
        when('I disconnect from the destination broker mirror queue', () => {
            try {
                queue.close();
                destConnection.close();
            } catch (e) {
                console.log(e);
            }
        });
        
        and(/^I publish (.*) messages to the source broker exchange$/, async (count) => {
            try {
                let sourceConnection: Amqp.Connection;sourceConnection = new Amqp.Connection( `amqp://${sourceBrokerHost}` );
                await publishToQueue(sourceConnection, publishQueue, count);
                await new Promise( (resolve: any) => setTimeout(resolve, 500));
                await sourceConnection.close();
            } catch (e) {
                console.log(e);
            }
        });
        
        then(/^on re-connection my subscription should receive (.*) messages$/, async (count) => {
            expect(messageCount).toBe(0);
            try {
                destConnection = await Rhea.connect({host: destBrokerHost, port: 5672} as Rhea.ConnectionOptions);
                let mirrorQueue = `Consumer.jest.VirtualTopic.${publishQueue}.wiretap`;
                queue = await destConnection.open_receiver(mirrorQueue);
                queue.on('message', (data: any) => { 
                    messageCount++;
                });    
            } catch(e) {
                console.log(e);
            }        
            await new Promise( (resolve: any) => setTimeout(resolve, 500));
            await queue.close();
            await destConnection.close();
            expect(messageCount).toBe( parseInt(count) );                   
        });
    });
        
});

function initialiseForwarding(queuePattern: string): string {
    return queuePattern;
}

async function publishToQueue(connection: Amqp.Connection, queueName: string, count: string) {
    try {
        let exchange = connection.declareExchange(queueName,'topic');
        for ( let i = 0; i < parseInt(count); i++) {
            await exchange.send( new Message(i + 1) );
        }
        exchange.close();
    } catch (e) {
        console.log(e);
    }
}