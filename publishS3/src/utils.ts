
export class GeneralHelper {
    theDeltaOf (incoming: any[], outgoing: any[]): any[] {
        if ( incoming === undefined ||
             outgoing === undefined ||
             incoming.length === 0 ||
             incoming.length === outgoing.length ) {
    
            return [];
        }    
        return incoming.slice(outgoing.length, incoming.length);
    }

    nearTimeout(startDateTime: Date, timeoutInSeconds: number, safetyMarginPercent: number): boolean {
        try {
            let delta = (new Date().getTime() - startDateTime.getTime()) / 1000;
            let ratio = (delta / timeoutInSeconds);
            let thresholdFraction = (100 - safetyMarginPercent) / 100;
            return ratio >= thresholdFraction;
        } catch (e) {
            console.log(e);
        }
        return false;
    }

    
    async sleep(millis: number): Promise<any> {
        await new Promise((resolve) => setTimeout(resolve, millis));
    }

    appendLeadingZeros (n: number, order: number = 1) {
        return n.toString().padStart(order,'0');
    }

    createKeyName = (queueName: string): string => {
        const date = new Date()
        const year = date.getFullYear()
        const month = this.appendLeadingZeros(date.getMonth() + 1)
        const day = this.appendLeadingZeros(date.getDate())
        const hours = this.appendLeadingZeros(date.getHours())
        const minutes = this.appendLeadingZeros(date.getMinutes())
        const seconds = this.appendLeadingZeros(date.getSeconds())
        const millis = this.appendLeadingZeros(date.getMilliseconds(),2);
    
        let filename = `${year}/${month}/${day}/${queueName}_${hours}:${minutes}:${seconds}.${millis}`;
        return filename;
    }
}
