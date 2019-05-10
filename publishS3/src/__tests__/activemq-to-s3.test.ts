import { ActiveMqToS3, EXIT_NEAR_TIMEOUT, EXIT_IDLE_NO_MESSAGES, EXIT_INFINITE_LOOP } from "../activemq-to-s3";
import { QueueToS3, QueueToS3Config } from "../queue-to-s3";
import { GeneralHelper } from "../utils";

const wiretapConfig: QueueToS3Config = { 
    bucketName: '',
    mqHost: '',
    mqPort: -1,
    queueName: '',
    timeout: 3 // needs to be less than jest timeout   
};
describe('activemq specific consumer should write stuff to s3', () => {
    it('should exit with "near timeout" when close to lambda timeout', async() => {
        let util = new GeneralHelper();
        util['nearTimeout'] = jest.fn().mockImplementation( () => true);
        let wiretap: QueueToS3 = new ActiveMqToS3(wiretapConfig, util);
        let exitCode = await wiretap.startLoop();
        expect(exitCode).toBe(EXIT_NEAR_TIMEOUT);
    });

    it('should exit with idle timeout when done nothing for a while', async () => {
        let util = new GeneralHelper();
        util['nearTimeout'] = jest.fn().mockImplementation( () => false);        
        let wiretap: QueueToS3 = new ActiveMqToS3(wiretapConfig, util);
        wiretap['secondsIdleIsGreaterThan'] = jest.fn().mockImplementation(() => true);
        let exitCode = await wiretap.startLoop();
        expect(exitCode).toBe(EXIT_IDLE_NO_MESSAGES);
    })

    it('should self terminate with infinite loop if conditions suspect one', async() => {
        let util = new GeneralHelper();
        util['nearTimeout'] = jest.fn().mockImplementation( () => false);        
        let wiretap: QueueToS3 = new ActiveMqToS3(wiretapConfig, util);
        wiretap['secondsIdleIsGreaterThan'] = jest.fn().mockImplementation(() => false);
        wiretap['hasCredit'] = jest.fn().mockImplementation(() => true);
        let exitCode = await wiretap.startLoop();
        expect(exitCode).toBe(EXIT_INFINITE_LOOP);
    });
});