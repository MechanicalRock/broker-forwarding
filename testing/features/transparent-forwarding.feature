Feature: Transparent forwarding of messages from Rabbitmq exchange to ActiveMQ destination

  Rules
    - forwarding messages has no impact on existing consumer queues on the source broker
    - all messages for selected exchanges are reliably forwarded to the destination broker
    - subscribers to destination mirror queues receive same messages as consumer queues

    Scenario: Publishing 10 messages results in 10 messages received on source consumer queue
      Given message forwarding is activated
        When I publish 10 messages to the source broker exchange 
          Then my source broker consumer queue should receive 10 messages

    Scenario: Publishing 10 messages results in 10 messages received on destination consumer queue
      Given message forwarding is activated
        When I publish 10 messages to the source broker exchange 
          Then my destination broker consumer queue should receive 10 messages

    Scenario: Publishing 10 messages results in 10 messages received on destination mirror queue
      Given message forwarding is activated
        And I have subscribed to destination broker mirror queue
        When I publish 10 messages to the source broker exchange 
          Then my subscription should receive 10 messages