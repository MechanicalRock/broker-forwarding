import { defineFeature, loadFeature } from 'jest-cucumber';

const feature = loadFeature('features/transparent-forwarding.feature');

defineFeature(feature, scenario  => {
    scenario('Publishing 10 messages results in 10 messages received on source consumer queue', ({ given, when, then }) => {
    	given('message forwarding is activated', () => {

    	});

    	when(/^I publish (.*) messages to the source broker exchange$/, (arg0) => {

    	});

    	then(/^my source broker consumer queue should receive (.*) messages$/, (arg0) => {
            fail();
    	});
    });

    scenario('Publishing 10 messages results in 10 messages received on destination consumer queue', ({ given, when, then }) => {
    	given('message forwarding is activated', () => {

    	});

    	when(/^I publish (.*) messages to the source broker exchange$/, (arg0) => {

    	});

    	then(/^my destination broker consumer queue should receive (.*) messages$/, (arg0) => {
            fail();
    	});
    });

    scenario('Publishing 10 messages results in 10 messages received on destination mirror queue', ({ given, and, when, then }) => {
    	given('message forwarding is activated', () => {

    	});

    	and('I have subscribed to destination broker mirror queue', () => {

    	});

    	when(/^I publish (.*) messages to the source broker exchange$/, (arg0) => {

    	});

    	then(/^my subscription should receive (.*) messages$/, (arg0) => {
            fail();
    	});
    });

});
